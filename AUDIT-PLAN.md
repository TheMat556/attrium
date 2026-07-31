# TODO: Audit & minimize the SCSS admin theme (remove dead selectors, generalize)

## Context

The `feat/scss-admin-theme` branch restyles the *embedded* WordPress admin pages via a second
SCSS pipeline (`scss/admin-theme.scss` → `app/dist/admin-theme.css`, loaded by
`Modules\ModuleRegistry`). It grew to ~660 lines of module CSS + ~1660 lines of per-screen CSS,
much written defensively against WP core. **We don't know which selectors are load-bearing.**

**Goal:** for every selector/declaration, remove it → rebuild CSS → run the visual test → if the
layout is unchanged, delete it; if it breaks, keep it. Do this in **light AND dark mode**. Where a
surviving pattern is truly generic (used 2+ times), promote it into `scss/_ui.scss` or a module.
Result: a smaller, provably-necessary stylesheet + a stronger test net.

**Rules:** No git commit / no push. Work one file at a time. When stuck on a file, write its open
points into `scss/AUDIT-OPEN-POINTS.md` and move on.

### Locked-in decisions (from the user)
- **Coverage:** expand Playwright to every screen that has a SCSS file *and* a no-fixture URL, in
  **light + dark**. Screens needing special setup → open-points, not audited empirically.
- **Interaction states** (`:hover/:focus/:active`): static screenshots don't capture them → **flag
  to open-points and KEEP**, never delete on a green static test.
- **Generalization:** conservative — extract only patterns duplicated across **2+ files**.

### Reference facts (verified — don't re-derive)
- Gating (`scss/_mixins.scss`): `module($name)` → `body.attrium-mod-#{$name} &`;
  `screen($cls...)` → `body.attrium-mod-screens.<wp-body-class> &`. Body classes emitted by
  `ModuleRegistry::body_classes()`; modules toggled by `attrium_enabled_modules` filter.
- Dark mode ≠ `prefers-color-scheme`. `useTheme.ts` → vueuse `useColorMode`,
  `storageKey:'attrium-theme'`, toggles class `dark` on `#attrium-host`; `main.ts` applies it at
  boot from localStorage BEFORE Vue mounts. Test hook: `page.addInitScript(() =>
  localStorage.setItem('attrium-theme','dark'))` before `goto`.
- Embedded WP recolors in dark because `main.ts` moves `#wpcontent` into `#attrium-host`, and
  `_tokens.css` defines dark tokens under `#attrium-host.dark, :host(.dark)`.
- Shared mixins already in `scss/_ui.scss`: `pill-track`, `pill-segment`, `pill-segment-active`,
  `field-outline`, `filter-toolbar`, `card-surface`, `wp-filter-surface`,
  `transparent-react-shell`, `hide-bottom-bulk-actions`. Extend this file; don't reinvent.
- Build: `bun run build` = vue-tsc + vite + `build:css`. **SCSS-only edits need just
  `bun run build:css`** (sass→tailwind→minify). `watch:css` for instant rebuilds.
- Tests run in the pinned Playwright **Docker** image (`tests/visual/run-in-docker.sh`).
  `bun run test:visual` = compare; `bun run test:visual:update` = refresh baselines.
  **Never `--update` on the host** (font-antialiasing → spurious diffs). Baselines:
  `tests/visual/<spec>.spec.ts-snapshots/<name>-chromium-linux.png`.
- **Do NOT touch:** `scss/_tokens.css` (shared with Vue build), `scss/_mixins.scss` (gating
  contract), `src/**`.

---

## Phase 0 — Safety net & baseline (once)

- [ ] 0.1 `bun run build` on the untouched branch — confirm it compiles green.
- [ ] 0.2 `bun run test:visual:update` (Docker) so committed baselines reflect the theme *as-is
      today*. These are the reference for every removal. (Update only — no git commit.)
- [ ] 0.3 Record starting size: `wc -c app/dist/admin-theme.css` → note the number here: `____`.
- [ ] 0.4 Create `scss/AUDIT-OPEN-POINTS.md` with sections: `Uncovered screens`,
      `Interaction-only rules (kept, unverified)`, `Ambiguous diffs`, `Generalization deferred`,
      `Stuck files`.

---

## Phase 1 — Expand test coverage (do BEFORE any deletion)

A green test on a screen the suite never renders means "uncovered", not "safe to delete".

### 1a. Add reachable screens → `tests/visual/pages.ts` `ADMIN_PAGES`
Add one entry per screen SCSS file with a no-fixture URL (already covered: plugins, posts-list,
users, site-health, profile):
- [ ] `pages` → `/wp-admin/edit.php?post_type=page`
- [ ] `update-core` → `/wp-admin/update-core.php`
- [ ] `upload` → `/wp-admin/upload.php`
- [ ] `media-new` → `/wp-admin/media-new.php`
- [ ] `import` → `/wp-admin/import.php`
- [ ] `themes` → `/wp-admin/themes.php`
- [ ] `theme-editor` → `/wp-admin/theme-editor.php`
- [ ] `nav-menus` → `/wp-admin/nav-menus.php`
- [ ] `tools` → `/wp-admin/tools.php`
- [ ] `privacy` → `/wp-admin/options-privacy.php`
- [ ] `plugin-install` → `/wp-admin/plugin-install.php`  ⚠ fetches wp.org
- [ ] `theme-install` → `/wp-admin/theme-install.php`  ⚠ fetches wp.org
- [ ] 1a.x If wp-env has no network in CI, the two ⚠ screens will be flaky → remove them from
      `ADMIN_PAGES` and record in `AUDIT-OPEN-POINTS.md` (Uncovered screens).
- [ ] 1a.y Extend `MASKS` in `screens.spec.ts` for any volatile content on new screens
      (update-core version strings, plugin/theme-install cards, counts).

### 1b. Add a dark-mode variant → `tests/visual/screens.spec.ts` + `buttons.spec.ts`
- [ ] Parametrize each spec over `[{theme:'light'},{theme:'dark'}]`.
- [ ] For dark: `await page.addInitScript(() => localStorage.setItem('attrium-theme','dark'))`
      BEFORE `page.goto`. Name snapshot `${name}-${theme}.png` (yields `<name>-light` /
      `<name>-dark` baselines). Apply the same dark pass to `buttons.spec.ts`.
- [ ] (Only if `addInitScript` proves insufficient) add a second Playwright project in
      `playwright.config.ts`; otherwise leave the single `chromium` project unchanged.

### 1c. Generate & sanity-check baselines
- [ ] 1c.1 `bun run build && bun run test:visual:update` (Docker) — full light+dark baseline set.
- [ ] 1c.2 Open the produced PNGs / HTML report. For EACH new screen confirm the Attrium theme
      actually took effect (body has `attrium-mod-*`; dark screens are dark). A screen that looks
      identical to un-themed WP → its SCSS isn't applying → record in open-points, exclude from
      the audit loop.
- [ ] 1c.3 List the still-uncovered screen files in `AUDIT-OPEN-POINTS.md`: `_options-connectors`,
      `_font-library`, plus any flaky/networked ones. These are reviewed manually, NOT via the loop.
- [ ] 1c.4 `bun run lint:check` (Biome) on the edited TS test files.

---

## Phase 2 — The per-file audit loop

### The loop (apply to every selector-block / declaration in a file)
1. **Exercised?** Identify which covered screen(s) render this selector. If none do, or it's
   interaction-only (`:hover/:focus/:active`) → **flag to open-points, KEEP, skip.**
2. **Remove** the selector/declaration from the `.scss` source.
3. **Rebuild CSS only:** `bun run build:css` (keep `watch:css` running to make this instant).
4. **Test the affected screen(s), both themes** (no `--update`, diff vs Phase-1 baselines):
   `bash tests/visual/run-in-docker.sh screens.spec.ts -g "<screen>"`.
5. **Decide:**
   - Pass (no diff) → style was a no-op → **delete permanently.**
   - Fail (diff) → **restore it**, add a one-line `// verified-necessary` comment, inspect the
     diff PNG to confirm it's real (not sub-threshold noise).
6. **Bisection shortcut** for big files: comment out the top half → test; green = whole half dead;
   red = split again. Cuts Docker runs on `_tables` (354), `_theme-editor` (276), `_nav-menus`
   (211), `_site-health` (212).
7. **After finishing a file:** `bun run build` (full) once, run the **entire** suite to catch a
   rule that looked dead on its home screen but props up a shared element elsewhere. Only then
   advance.

### Order & per-file checklist

**Modules (simplest → hardest):**
- [ ] `scss/modules/_notification.scss` (12) — run loop, then full suite.
- [ ] `scss/modules/_notices.scss` (76)
- [ ] `scss/modules/_tabs.scss` (31)
- [ ] `scss/modules/_forms.scss` (82)
- [ ] `scss/modules/_buttons.scss` (109) — buttons verified partly by `buttons.spec.ts` hover/
      active; the base/variant mixins are `@include`d, so removal = edit the mapping at the bottom.
- [ ] `scss/modules/_tables.scss` (354) — use bisection.

**Shared mixins (audit via call sites):**
- [ ] `scss/_ui.scss` (166) — a mixin emits no CSS itself; test by removing an `@include` at each
      call site. If removing an include anywhere causes no diff on any covered screen, the mixin (or
      that portion) is dead. Track per-mixin usage: `pill-*`, `field-outline`, `filter-toolbar`,
      `card-surface`, `wp-filter-surface`, `transparent-react-shell`, `hide-bottom-bulk-actions`.

**Screens (grouped; covered ones only — uncovered → open-points):**
- [ ] `scss/screens/_base.scss` (56) — all-screens base; test across MANY screens (regressions here
      are broad).
- [ ] `scss/screens/_posts.scss` (19) + `scss/screens/_pages.scss` (26)
- [ ] `scss/screens/_users.scss` (12) + `scss/screens/_profile.scss` (21)
- [ ] `scss/screens/_tools.scss` (18) + `scss/screens/_import.scss` (11) +
      `scss/screens/_privacy.scss` (39) + `scss/screens/_update-core.scss` (11) +
      `scss/screens/_media-new.scss` (11)
- [ ] `scss/screens/_upload.scss` (95)
- [ ] `scss/screens/_plugins.scss` (7) + `scss/screens/_plugin-install.scss` (134) — ⚠ networked;
      audit only if 1c confirmed it renders, else open-points.
- [ ] `scss/screens/_themes.scss` (174) + `scss/screens/_theme-install.scss` (57) — share the
      `theme-cards` look; ⚠ theme-install networked.
- [ ] `scss/screens/_theme-editor.scss` (276) — bisection.
- [ ] `scss/screens/_nav-menus.scss` (211) — bisection.
- [ ] `scss/screens/_site-health.scss` (212) — bisection.
- [ ] **Open-points only (not covered):** `scss/screens/_options-connectors.scss` (135),
      `scss/screens/_font-library.scss` (138) — record for manual review.

---

## Phase 3 — Generalization pass (conservative, AFTER removals)

- [ ] 3.1 From the running notes, list patterns appearing in **2+ surviving screen files** that are
      NOT already a `_ui.scss` mixin.
- [ ] 3.2 For each, classify **general** (screen-agnostic component markup — list-table, `.notice`,
      `.button`, card) vs **site-specific** (one screen's unique DOM). Only general → promote.
- [ ] 3.3 Promote a general pattern to: an `@include` mixin in `scss/_ui.scss` (caller owns the
      gate — the established pattern), OR a new module partial under `scss/modules/` only if it's a
      toggleable standalone component. If a new module: register it in `ModuleRegistry.php`
      `$defaults` AND `@use` it in `scss/admin-theme.scss`.
- [ ] 3.4 Rewire call sites to the shared mixin, `bun run build`, run the **full** suite — green =
      visually-identical refactor (safe). Any diff → revert or adjust.
- [ ] 3.5 Single-use patterns → note in `AUDIT-OPEN-POINTS.md` (Generalization deferred); do NOT
      create speculative modules.

---

## Phase 4 — Wrap-up & verification

- [ ] 4.1 `bun run build` (full) succeeds — SCSS compiles, Tailwind `@apply`s resolve.
- [ ] 4.2 `cd admin && composer lint` IF `ModuleRegistry.php` was edited (PHPCS, 4-space).
- [ ] 4.3 `bun run lint:check` (Biome, tabs/width-80) for all TS test changes.
- [ ] 4.4 `bun run test:visual` (Docker) — every covered screen, light + dark, green vs Phase-1
      baselines. (Green after deletions = proof they were dead.) Deliberate visual improvements get
      a conscious `test:visual:update` + diff eyeball.
- [ ] 4.5 Report CSS size reduction: `wc -c app/dist/admin-theme.css` vs 0.3.
- [ ] 4.6 Hand over `scss/AUDIT-OPEN-POINTS.md` (uncovered screens, kept-but-unverified interaction
      rules, ambiguous diffs, deferred generalizations, stuck files).
- [ ] 4.7 Do NOT commit or push — stop and report.

---

## Files touched (summary)
- **Extend:** `tests/visual/pages.ts`, `tests/visual/screens.spec.ts`,
  `tests/visual/buttons.spec.ts`, maybe `playwright.config.ts`; regenerated baselines under
  `tests/visual/*-snapshots/`.
- **Edit heavily:** all `scss/modules/*.scss`, all covered `scss/screens/*.scss`, `scss/_ui.scss`;
  maybe `scss/admin-theme.scss` + `admin/src/Modules/ModuleRegistry.php` (only if a new module is
  created).
- **New:** `scss/AUDIT-OPEN-POINTS.md`.
- **Never touch:** `scss/_tokens.css`, `scss/_mixins.scss`, `src/**`.

## Risks
- **Threshold blindness:** `maxDiffPixelRatio:0.01` + `threshold:0.2` passes tiny changes → a style
  causing a <1% shift reads as "dead". Inspect diff PNGs on borderline blocks; keep interaction/edge
  rules rather than trust a marginal green.
- **Docker mandatory** for baselines; never `--update` on host.
- **Rebuild scope:** SCSS-only → `build:css`; run full `build` before whole-suite runs so JS
  bundle/manifest stay coherent.
- **Cross-screen coupling:** re-run the full suite between files — a rule dead on its home screen may
  style a shared element elsewhere.
