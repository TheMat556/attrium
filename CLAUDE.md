# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Attrium is a WordPress admin theme plugin. A PHP bootstrap injects a Vue 3 single-page app that **wraps the entire wp-admin** in a custom shell (sidebar + header), and either embeds the real WordPress page or replaces it with a native Vue view. The plugin lives in `wp-content/plugins/attrium`; the running WordPress install is the parent tree.

## Commands

Frontend uses **Bun**. PHP tooling lives in `admin/` and uses Composer.

```bash
bun run dev          # Vite dev server
bun run build        # vue-tsc -b && vite build  → app/dist/ (REQUIRED: PHP reads the manifest)
bun run lint         # Biome check --write (fix)
bun run lint:check   # Biome check (CI, no writes)
bun run format       # Biome format --write

cd admin && composer lint     # phpcs  (ruleset: admin/phpcs.xml.dist, WordPress-Extra, 4-space indent)
cd admin && composer format   # phpcbf (autofix)
```

PHPCS gotcha: always pass `--standard=admin/phpcs.xml.dist` if running `phpcs` directly from the repo root — otherwise it falls back to default rules and reports phantom errors. `composer lint` from inside `admin/` handles this.

There is no test suite. CI (`.github/workflows/ci.yml`) runs `lint:check`, PHPCS, and a production build — nothing else gates merge.

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

## Conventions
- Biome formats JS/TS/Vue: **tabs**, line width 80. PHP is **4-space** indent (WordPress-Extra). Don't mix.
- UI components in `src/components/ui/` are generated (shadcn-vue) — prefer regenerating over hand-editing.
- Commit format: `<type>: <description>` (feat, fix, refactor, docs, test, chore, perf, ci).
