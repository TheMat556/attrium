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
	// Theme editor edits the active theme's files (default: style.css). The
	// tree reflects the fixed default theme in the disposable wp-env install,
	// so it is deterministic here even though the host dev tree is not.
	{ name: 'theme-editor', path: '/wp-admin/theme-editor.php' },
	{ name: 'nav-menus', path: '/wp-admin/nav-menus.php' },
	{ name: 'tools', path: '/wp-admin/tools.php' },
	{ name: 'privacy', path: '/wp-admin/options-privacy.php' },
	// `_profile.scss` gates on `profile-php` and `user-edit-php`. user-edit is
	// reached with an explicit user_id; 1 is the wp-env admin.
	{ name: 'user-edit', path: '/wp-admin/user-edit.php?user_id=1' },
	// plugin-install renders live wp.org results; the determinism mu-plugin now
	// stubs `plugins_api` with a fixed catalog, so it is offline and stable.
	{ name: 'plugin-install', path: '/wp-admin/plugin-install.php' },
	// Same for theme-install: `themes_api` is stubbed with a fixed catalog.
	{ name: 'theme-install', path: '/wp-admin/theme-install.php' },
]

/**
 * Known coverage gaps, recorded so they are not mistaken for "verified".
 *
 * - `scss/screens/_theme-editor.scss` — the Plugin Editor screen
 *   (plugin-editor.php) shares `_theme-editor.scss`'s markup but points at the
 *   plugin's own file tree; the theme editor itself is now a fixture
 *   (`theme-editor`), so the shared rules are covered under the
 *   `theme-editor-php` body class. `plugin-editor-php` stays unverified because
 *   its tree reflects the attrium plugin's source (build output, node_modules),
 *   which is not deterministic across environments.
 * - `scss/screens/_font-library.scss` (138 lines) — Appearance → Fonts. Gated
 *   with `module('screens')` rather than a body class, and driven entirely by
 *   remapped `--wpds-*` variables on a React app whose class names are
 *   per-build CSS-module hashes. Needs its own spec.
 * - `scss/screens/_options-connectors.scss` (135 lines) — also `module('screens')`
 *   rather than a known core body class, so there is no single URL to add here.
 */
