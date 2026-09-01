# SCSS Coverage TODO

This checklist is intentionally limited to the active SCSS files currently staged in Git.

A file is marked complete when the relevant visual suite and mutation checks pass against the current working tree. Structural-only changes are marked complete immediately when they add no CSS rule or styling behavior; this includes entry wrappers, comments/newlines, and equivalent recipe/namespace refactors. A surviving mutation is removed from the source by `scripts/mutate-staged-theme-scss.mjs`; a killed mutation is restored.

`Killed` means the visual suite detected the temporary mutation. `Survived` means the current suite did not detect it, so the declaration is removed for follow-up verification. `Ongoing` means behavioral mutation/visual testing is still pending or incomplete.

## Finished

These staged files only add wiring, comments/newlines, or equivalent refactors and do not apply a new CSS rule:

- [x] `scss/entries/base.scss`
- [x] `scss/entries/buttons.scss`
- [x] `scss/entries/checkbox.scss`
- [x] `scss/entries/forms.scss`
- [x] `scss/entries/notices.scss`
- [x] `scss/entries/notification.scss`
- [x] `scss/entries/screen-meta.scss`
- [x] `scss/entries/screens.scss`
- [x] `scss/entries/tables.scss`
- [x] `scss/entries/tabs.scss`
- [x] `scss/modules/_buttons.scss`
- [x] `scss/modules/_checkbox.scss`
- [x] `scss/modules/_screen-meta.scss`
- [x] `scss/modules/_tables.scss`
- [x] `scss/modules/_tabs.scss`
- [x] `scss/screens/_font-library.scss`
- [x] `scss/screens/_nav-menus.scss`
- [x] `scss/screens/_options-connectors.scss`
- [x] `scss/screens/_pages.scss`
- [x] `scss/screens/_plugin-install.scss`
- [x] `scss/screens/_plugins.scss`
- [x] `scss/screens/_privacy.scss`
- [x] `scss/screens/_site-health.scss`
- [x] `scss/screens/_upload.scss`

## Ongoing

These staged files add or alter CSS rules, tokens, gates, icons, or reusable recipes and need mutation/visual-test results:

- [x] `scss/_icons.scss`
- [x] `scss/_mixins.scss`
- [x] `scss/_tokens.scss`
- [x] `scss/modules/_forms.scss`
- [x] `scss/screens/_customize-controls.scss`
- [x] `scss/screens/_customize-menus.scss`
- [x] `scss/screens/_customize-shell.scss`
- [x] `scss/screens/_customize-themes.scss` — every declaration survived the customize suite (13 passing, light+dark); removed. Caveat: the suite never opens the themes panel, so survival is a coverage gap — re-audit after adding a themes-panel capture.
- [x] `scss/screens/_theme-editor.scss` — mutation-audited against the theme-editor screen captures (light+dark). 17 KILLED (tree frame/heading/labels/links, current-file marker, dark CodeMirror chrome + syntax), 17 SURVIVED (hover/focus rows, disclosure arrow, tree connectors, editor notices, caret/selection/bracket/error states, notice color/padding). Survivors removed per method — edge states remain unverified (static capture can't render them).
- [x] `scss/screens/_theme-install.scss` — mutation-audited against the screen captures (light+dark), the components drawer suite (`components/theme-install.spec.ts`), and the NEW `theme-install-overlay.spec.ts` (opens the Details/Preview overlay; live-preview iframe masked). KILLED (kept): filter-toolbar, toolbar flex + margins, count badge, field-outline, the feature-filter drawer rules (toolbar flex-basis/margin + ui.filter-drawer — caught by the components suite), and the overlay header/nav/action/sidebar/info/details/footer/collapse chrome. SURVIVED (removed): search px-3, upload-card include, overlay backdrop/header-gap+margin-left+background/sidebar-border-right/main-bg, and 3 dead nav-glyph mask selectors. NOTE: an early audit pass against only the screen config wrongly marked the drawer rules survived; the components suite caught them — audit greps must span both configs.
- [x] `scss/screens/_themes.scss` — mutation-audited against the themes screen captures (light+dark), the in-card notice suite (`components/theme-card-notice.spec.ts`), and the details-overlay captures (`theme-details-overlay.spec.ts`). KILLED (kept): add-new-theme hide, card shell, active ring, screenshot border+bg, footer + card name, theme-actions row, in-card notice, and the entire `.theme-overlay` modal chrome (backdrop, wrap, header flex + nav buttons + close margin + icon masks, active label, name/version/author/description/tags). SURVIVED (removed): the global `body{overflow:hidden}` (shell/card own scrolling — unverifiable), card background (verified invisible), card hover/focus border + `.more-details` hover button (hover-only, zero capture coverage), the card `.theme-author` (display:none in fixtures), `.theme-about`/`.theme-header` background (verified), and `.theme-screenshots` bg + `.screenshot` radius (wrap clips). NOTE: the close-button margin and the three icon-mask rules initially looked SURVIVED but the moves/removal are under the spec's 200px `maxDiffPixels` budget (16px glyphs); verified via in-docker element probes that they truly move/disappear — restored as KILLED. KEPT BY DECISION: `.parent-theme` (child-theme callout — no fixture theme is a child, zero coverage; same class as the installer overlay the user chose to restore). RESTORED AFTER LIVE-SITE REPORT: the secondary action button (Activate) — core out-specifies it to `#fff`, so without the rule a live card shows a white pill in dark mode (user observed it on webdev.hader.ovh); the actions row renders at opacity:0, so no static capture covers it, but it is a real regression.
- [ ] `scss/ui/_patterns.scss`
- [ ] `scss/ui/_primitives.scss`

## Results

The mutation runner prints:

- `FINISHED <file>` when every declaration in the file is classified as killed or survived, or when the file has no declarations;
- `ONGOING <file>` when a declaration cannot be matched, the build fails, or a test run is incomplete;
- `FINISHED_FILES [...]` and `ONGOING_FILES [...]` as machine-readable file lists;
- `SUMMARY {...}` with per-declaration counts.

Structural-only files above are considered finished before the mutation run under the no-new-rule exception. Add per-declaration `KILLED`/`SURVIVED` results here after the runner completes if an audit trail is needed.
