# Audit Open Points

## Uncovered screens
*Screens with SCSS files but no visual test coverage (no no-fixture URL or requires special setup):*
- `_options-connectors.scss` (135 lines) — `/wp-admin/options-general.php?page=...` connector pages, no generic URL
- `_font-library.scss` (138 lines) — requires a font library plugin, not available in base wp-env

## Interaction-only rules (kept, unverified)
*Selectors only active on :hover/:focus/:active that are kept because static screenshots cannot verify them.*

## Ambiguous diffs
*List cases where a removal caused a diff that needs manual review.*

## Generalization deferred
*List single-use patterns noted for possible future extraction.*

## Stuck files
*List files where the audit hit a blocker.*

## Flaky/networked screens
*Screens that require network access (wp.org API), excluded from automated audit loop until CI network is confirmed:*
- `plugin-install` → `/wp-admin/plugin-install.php`
- `theme-install` → `/wp-admin/theme-install.php`

Both listed in `NETWORKED_PAGES` in `tests/visual/pages.ts` for manual review.
