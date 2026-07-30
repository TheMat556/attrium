/**
 * The wp-admin screens under visual regression.
 *
 * Each entry pairs a stable snapshot `name` with the admin `path` to visit.
 * This starting set is deliberately small but representative of what the
 * SCSS branch restyles: tables, buttons, tabs, and forms across the screens
 * gated by `scss/screens/*` and `scss/modules/*`.
 *
 * To cover another gated screen, add one entry here — no other file changes.
 * (See `scss/_mixins.scss` `screen()` for the full gated list.)
 */
export interface AdminPage {
	/** Snapshot file stem; must be filesystem-safe and stable. */
	name: string
	/** wp-admin path, relative to baseURL. */
	path: string
}

export const ADMIN_PAGES: AdminPage[] = [
	{ name: 'plugins', path: '/wp-admin/plugins.php' },
	{ name: 'posts-list', path: '/wp-admin/edit.php' },
	{ name: 'users', path: '/wp-admin/users.php' },
	{ name: 'site-health', path: '/wp-admin/site-health.php' },
	{ name: 'profile', path: '/wp-admin/profile.php' },
	{ name: 'pages', path: '/wp-admin/edit.php?post_type=page' },
	{ name: 'update-core', path: '/wp-admin/update-core.php' },
	{ name: 'upload', path: '/wp-admin/upload.php' },
	{ name: 'media-new', path: '/wp-admin/media-new.php' },
	{ name: 'import', path: '/wp-admin/import.php' },
	{ name: 'themes', path: '/wp-admin/themes.php' },
	{ name: 'theme-editor', path: '/wp-admin/theme-editor.php' },
	{ name: 'nav-menus', path: '/wp-admin/nav-menus.php' },
	{ name: 'tools', path: '/wp-admin/tools.php' },
	{ name: 'privacy', path: '/wp-admin/options-privacy.php' },
	// `_theme-editor.scss` gates on both `theme-editor-php` AND
	// `plugin-editor-php` via the variadic `screen()`, so the plugin editor
	// exercises the same rules against different markup.
	{ name: 'plugin-editor', path: '/wp-admin/plugin-editor.php' },
	// `_profile.scss` gates on `profile-php` and `user-edit-php`. user-edit is
	// reached with an explicit user_id; 1 is the wp-env admin.
	{ name: 'user-edit', path: '/wp-admin/user-edit.php?user_id=1' },
]

/**
 * Screens that may be flaky in CI due to network dependency (wp.org API calls).
 * Excluded from the automated audit loop but listed here for manual review.
 *
 * These render remote search results, so their content is not ours to pin —
 * unlike the update banners, which `mu-plugins/attrium-visual-determinism.php`
 * freezes. Covering them would mean stubbing the wp.org HTTP responses via a
 * `pre_http_request` filter in that same mu-plugin; worth doing, but it is a
 * larger fixture job than the rest of this suite.
 */
export const NETWORKED_PAGES: AdminPage[] = [
	{ name: 'plugin-install', path: '/wp-admin/plugin-install.php' },
	{ name: 'theme-install', path: '/wp-admin/theme-install.php' },
]

/**
 * Known coverage gaps, recorded so they are not mistaken for "verified".
 *
 * - `scss/screens/_font-library.scss` (138 lines) — Appearance → Fonts. Gated
 *   with `module('screens')` rather than a body class, and driven entirely by
 *   remapped `--wpds-*` variables on a React app whose class names are
 *   per-build CSS-module hashes. Needs its own spec.
 * - `scss/screens/_options-connectors.scss` (135 lines) — also `module('screens')`
 *   rather than a known core body class, so there is no single URL to add here.
 */
