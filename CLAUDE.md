# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Attrium is a WordPress admin theme plugin. A PHP bootstrap injects a Vue 3 single-page app that **wraps the entire wp-admin** in a custom shell (sidebar + header), and either embeds the real WordPress page or replaces it with a native Vue view. The plugin lives in `wp-content/plugins/attrium`; the running WordPress install is the parent tree.

## Commands

Frontend uses **Bun**. PHP tooling lives in `admin/` and uses Composer.

```bash
bun run dev          # Vite dev server
bun run build        # vue-tsc -b && vite build  → app/dist/ (REQUIRED: PHP reads the manifest)
bun run build:css    # per-topic chunks: scripts/build-css.mjs compiles each scss/entries/*.scss
                     # → app/dist/admin-theme-{topic}.css (base tokens + one per enabled module + screens)
bun run lint         # Biome check --write (fix)
bun run lint:check   # Biome check (CI, no writes)
bun run format       # Biome format --write

cd admin && composer lint     # phpcs  (ruleset: admin/phpcs.xml.dist, WordPress-Extra, 4-space indent)
cd admin && composer format   # phpcbf (autofix)

bun run test:visual           # visual regression: compare against committed baselines (what CI runs)
bun run test:visual:update    # regenerate baselines (run on a clean tree, then commit)
bun run test:visual:local     # same, for constrained envs (running as root / node only via nvm)
bun run test:visual:report    # open the last Playwright HTML report
```

PHPCS gotcha: always pass `--standard=admin/phpcs.xml.dist` if running `phpcs` directly from the repo root — otherwise it falls back to default rules and reports phantom errors. `composer lint` from inside `admin/` handles this.

The only tests are Playwright visual regression (see below). Two CI workflows gate merge: `.github/workflows/ci.yml` runs `lint:check`, PHPCS, and a production build; `.github/workflows/visual.yml` runs the visual suite and fails on any pixel diff over threshold.

**After any frontend change, run `bun run build`.** PHP serves the hashed bundle by reading `app/dist/.vite/manifest.json`; without a rebuild, wp-admin loads a stale or missing bundle.

## Architecture

### PHP → JS bridge
- `attrium.php` boots `Attrium\App\Attrium` (PSR-4, autoloaded from `admin/vendor/`).
- `Attrium` hooks `in_admin_header` and enqueues the built JS/CSS. It resolves hashed filenames via `Attrium\Utility\Scripts`, which parses the Vite manifest — the only link between the PHP and JS build outputs.
- Server state reaches the client as data attributes on a `<script id="attrium-data">` tag (rest base/nonce, user, `menu`, `screen-id`, plugin version). `src/composables/useServerData.ts` reads them back. **Adding a server value means editing both `Attrium::output_data_attributes()` and `useServerData.ts`.**
- `Attrium\Utility\Menu` flattens WordPress globals `$menu`/`$submenu` into the JSON consumed by the sidebar (`NavMain.vue`), stripping separators and the self-referential Attrium entry.

### Shadow DOM + light-DOM slot embedding (the core trick)
`src/main.ts` is the entry point and does the non-obvious wiring:
1. Creates `#attrium-host` (fixed, fullscreen), attaches a **shadow root**, and mounts the Vue app inside it. Scoped Tailwind styles (`style.css?inline`) live in the shadow root so the Tailwind preflight reset cannot leak into wp-admin.
2. The Vue shell renders a real HTML `<slot name="wp-content">` via `<component is="slot">` (Vue's own `<slot>` is a virtual outlet, not a DOM node).
3. main.ts then moves WordPress's `#wpcontent` into `#attrium-host` as a **light-DOM child** with `slot="wp-content"`, so the shadow slot projects it into the content card while all WordPress CSS still applies to it.
4. PHP emits a temporary FOUC hider (`#attrium-body-hider`) that hides `<body>` until main.ts confirms the slot exists and removes it. If the slot is missing, the hider stays — the page fails visibly instead of going silently blank.

**The header stays pinned by layout, not `position: sticky`.** `#attrium-host` is `position: fixed; inset: 0; overflow: hidden` and does NOT scroll. `App.vue` renders a fixed-height column: `SidebarProvider class="h-full overflow-hidden"` → `SidebarInset class="ml-0 min-h-0"` → pinned `SiteHeader` + the rounded content card. The card (`data-attrium-scroll`, `flex-1 min-h-0 overflow-y-auto rounded-xl`) is the sole scroll container, so the header and the card's rounded corners/margins never move while page content scrolls beneath the header. Its inner wrapper is `min-h-full` (not `flex-1`) so it grows with content and drives the card's scrollHeight. Don't reintroduce `sticky top-0` on the header or `overflow-y: auto` on the host — that makes content slide under the header, chopping the card's rounded corners and swallowing the `SidebarInset`'s top margin.

**The card is the visible surface, not the inner wrapper.** `bg-background` (and the `isIgnored` `--background` override) live on the card itself, and the inner wrapper is transparent, so the card's rounded corners are drawn by the card's own background no matter what. A width-consuming (classic) scrollbar would otherwise inset a backgrounded inner wrapper past the corner-radius arc, leaving square corners at mid-scroll. The card's scrollbar is styled to match: transparent track plus a pill-shaped, 2px-inset webkit thumb (`background-clip: padding-box`) and an explicit Firefox `scrollbar-width: thin`/`scrollbar-color`, so the thumb never paints over the corner arcs.

### Native page overrides (registry pattern)
Some screens are replaced by native Vue views instead of embedding WP:
- `src/views/overrides.ts` is the **single source of truth**: a `Record<screenId, Component>` keyed by WordPress `WP_Screen->id` (emitted as `screen-id`).
- `App.vue` looks up `getScreenOverride(screenId)`; if found it renders that component, otherwise it renders the `wp-content` slot. When overridden, **no slot is rendered**, so main.ts skips the `#wpcontent` move (slot-presence is the runtime signal).
- **To override a new page: add one entry to `overrides.ts` and create its view.** App.vue, main.ts, and PHP do not change. Use a lazy import (`() => import('./X.vue')`) for heavy views.
- `Attrium::is_overlay_screen()` is a separate denylist that disables Attrium entirely on the block/site editor and customizer (they own their own full-screen layout).

### reka-ui portal shim
The app lives in a shadow root, but reka-ui portals (dialogs, dropdowns, tooltips) default to `to="body"` — outside the shadow root, where scoped styles don't reach. `src/lib/reka-ui.ts` re-exports reka-ui but wraps every `*Portal` so `to` defaults to a portal container inside the shadow root (`window.__ATTRIUM_PORTAL__`, set in main.ts). `vite.config.ts` aliases bare `reka-ui` imports to this shim, so regenerating shadcn components keeps the behavior.

### Theme
`src/composables/useTheme.ts` uses vueuse `useColorMode` targeting `#attrium-host` (the shadow host, not `<html>`) with the `dark` class, so dark mode applies inside the shadow tree.

### Toolbar capture
`src/composables/useToolbar.ts` scrapes the WordPress admin bar (`#wpadminbar`) into structured `ToolbarItem[]` that `SiteHeader.vue` re-renders as header buttons (via `ToolbarItemIcon.vue` / `ToolbarSubmenu.vue`). Two non-obvious constraints:
- **The admin bar must stay rendered, not `display:none`.** `Attrium::build_attrium()` hides it with `opacity:0;pointer-events:none` (NOT `display:none`) specifically so the scraper can read it: `extractIcon` calls `getComputedStyle(el, '::before')` for CSS-font icons (dashicons), and the name fallbacks use `innerText` — both return empty for `display:none` elements. Reverting that CSS to `display:none` silently breaks icon/name capture.
- **Scrape is one-shot, on mount.** `useToolbar` reads the DOM once in `onMounted`. This is correct because the admin bar is server-rendered (plugins add nodes via the `admin_bar_menu` PHP hook, present before Vue boots). A plugin that injects an admin-bar node via client-side JS *after* mount will not appear in the Attrium header — if that's ever reported, a `MutationObserver` on `#wpadminbar` is the fix, but it wasn't added to avoid re-scrape churn for a case with no known occurrence.

## Testing (visual regression)

The only tests are Playwright visual-regression snapshots that guard the SCSS/theme work (`tests/visual/`). They screenshot each restyled wp-admin screen with Attrium active and pixel-diff it against a committed baseline.

- **Disposable WordPress via `@wordpress/env`.** `.wp-env.json` boots WordPress 6.7 + MySQL in Docker with this plugin active, served on `http://localhost:8888` with a deterministic fresh install (admin / password). Docker must be running.
- **Determinism is enforced server-side, not by masking.** `.wp-env.json` maps `tests/visual/mu-plugins/` into `wp-content/mu-plugins`; `attrium-visual-determinism.php` freezes the core/plugin/theme update transients, pins post dates, and adds `menus` theme support. Without it WordPress renders live wp.org update state — the `.update-nag` banner on *every* screen, 14 "New version available" overlays on themes.php, and the admin-bar update counter that `useToolbar` scrapes into Attrium's own header — so baselines would break on WordPress's release schedule rather than on a real CSS change. **`MASKS` in `screens.spec.ts` is intentionally empty**; prefer pinning a value there over masking, because a mask paints an opaque box that removes the region from coverage entirely.
- **Screenshots ALWAYS render inside the pinned Playwright Docker image** (`tests/visual/run-in-docker.sh`, tag must match the `@playwright/test` version in `package.json`). Font antialiasing differs between machines, so running Playwright on the host directly produces spurious diffs and will not match the committed baselines. The `test:visual*` scripts enforce this.
- **Baselines are committed** (`tests/visual/*-snapshots/*.png`). Everything else (`.auth/`, `test-results/`, `playwright-report/`) is gitignored. When a visual change is intentional, regenerate with `bun run test:visual:update` on a clean tree and commit the new PNGs.
- **Auth is one-shot.** `auth.setup.ts` logs in once and saves the session to `tests/visual/.auth/state.json`; the `chromium` project reuses it (setup → chromium dependency in `playwright.config.ts`). Workers are serial (`workers: 1`) because a single WP instance has shared state.
- **`stabilize()` before every snapshot** waits for Attrium's FOUC hider (`#attrium-body-hider`) to be removed (the signal the shell mounted), **asserts the shell exists and that `#wpcontent` was reparented into it**, waits on `document.fonts.ready`, then zeroes animations/transitions. That assertion is load-bearing: it previously swallowed a missing shell, so the Menus baseline was a WordPress 500 error page (identical in light and dark) while the suite reported green.
- **Captures target `#attrium-host`, and `fullPage` does not work.** The host is `position: fixed; inset: 0; overflow: hidden` and the app is a fixed-height column, so the *document* never scrolls — `fullPage: true` silently produced 1440×900 shots that cropped everything below the fold. Snapshotting the host alone isn't enough either (an element screenshot uses the bounding box, viewport-sized for a fixed element), so `snapshotTarget()` grows the viewport to the content card's full height first. The card (`[data-attrium-scroll]`, set in App.vue) is the sole scroll container — its `scrollHeight` (plus the fixed chrome above/below) is the sizing signal; the host no longer grows. Baselines therefore vary in height (themes.php is 2318px tall).
- **`expect.toHaveScreenshot.threshold` must stay small (`0.02`).** It is a per-pixel *color* budget, not an antialiasing knob. At Playwright's `0.2` default a real regression (`--attrium-border` `oklch(0.922)`→`oklch(0.86)`) passed on all 31 screens; at `0.02` it fails on 16. Renderer jitter is absorbed by `maxDiffPixels: 200` — a flat count, deliberately not `maxDiffPixelRatio`, so sensitivity doesn't decay as screens get taller. **If you touch either value, re-run that mutation and confirm the suite still fails.**
- **Adding a screen: add one `{ name, path }` entry to `tests/visual/pages.ts`**, then `bun run test:visual:update` to capture its baseline. No other file changes. Interaction states (hover/active) that don't show in a full-page shot get their own spec (see `buttons.spec.ts`). Known coverage gaps are listed at the bottom of `pages.ts`.
- **The Customizer is covered by its own spec (`tests/visual/customize.spec.ts`), not `pages.ts`.** customize.php is an overlay screen with no `#attrium-host` (see `Attrium::is_overlay_screen()`), so `stabilize()`'s shell assertion cannot run there. The spec ships its own settle helper but reuses the shared `growViewportToFit`/`freezeAnimations` from `support/theme.ts`, captures the 300px sidebar (`#customize-controls`), deliberately excludes the preview iframe (live front page), and drives light/dark through the same `attrium-theme` key via `html.attrium-dark`. It covers the main accordion, an open section sub-pane (`autofocus[section]=title_tagline`), the open Menus panel (`autofocus[panel]=nav_menus`, back button + panel-meta + menu sub-sections) and a ≤640px mobile capture for the Customize/Preview toggle and the flexed header actions bar. Pane waits use `.open` (sections) / `.current-panel` (panels).
- **Constrained environments** (running as root — wp-env refuses root — or `node` only via nvm): use `bun run test:visual:local` (`tests/visual/run-local.sh`), which builds as the current user then runs wp-env + Playwright as a non-root user and restores file ownership. Forward Playwright args after `--` (e.g. `-- --update-snapshots`).

## Conventions
- Biome formats JS/TS/Vue: **tabs**, line width 80. PHP is **4-space** indent (WordPress-Extra). Don't mix.
- UI components in `src/components/ui/` are generated (shadcn-vue) — prefer regenerating over hand-editing.
- Commit format: `<type>: <description>` (feat, fix, refactor, docs, test, chore, perf, ci).

## SCSS organization (`scss/`)
- `_tokens.scss` is the single source of truth for the `--attrium-*` palette; it is a Sass map (light + dark) with a compile-time guard so a token can't miss its dark value. Emitted by `entries/base.scss` into `admin-theme-base.css` and injected into the Vue shadow root by `src/main.ts`.
- `entries/*.scss` are the build topics — one per PHP module (`ModuleRegistry::enqueue_styles()` loads `admin-theme-{topic}.css`). `entries/screens.scss` is the one big chunk (all per-screen reskins); the module axis is chunked per-module but the screens axis is not yet.
- `scss/ui/_primitives.scss` holds **element recipes** (pure style, include inside a gated rule: `link-primary`, `card-surface`, `icon-button`, `accent-hover`, …). `scss/ui/_patterns.scss` holds **composite recipes** that emit their own top-level blocks (`filter-toolbar`, `filter-drawer`, `hide-bottom-bulk-actions`, …) — include those at top level under `screen-root(...)`, never `screen(...)`. The namespace (`primitives.` vs `patterns.`) is the enforcement of that rule.
- `scss/_mixins.scss` contains the gate mixins (`module`, `screen`, `screen-root`) and their selector helpers. Keep style recipes out of it.
- The Customizer reskin is three files aligned with core's CSS structure: `screens/_customize-shell.scss` (overlay chrome + sidebar + footer), `_customize-controls.scss` (accordion + controls + editor), `_customize-menus.scss`. (A former `_customize-themes.scss` was removed — every declaration survived the customize visual suite.)
