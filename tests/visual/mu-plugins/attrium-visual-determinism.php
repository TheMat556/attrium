<?php
/**
 * Plugin Name: Attrium Visual-Regression Determinism
 * Description: Test-environment-only shims that make wp-admin byte-stable for visual regression. Mapped into wp-env via .wp-env.json; NEVER shipped with the plugin.
 *
 * Without this, the visual suite is unpinnable: WordPress phones home to
 * wp.org and renders the live "WordPress X.Y.Z is available!" nag, per-theme
 * "New version available" banners, and update counts in the admin bar. Those
 * strings change every time WordPress or a bundled theme ships a release, so
 * every committed baseline would break on someone else's schedule — not
 * because Attrium's CSS changed.
 *
 * The alternative (masking the banners) is strictly worse: a Playwright mask
 * paints an opaque box over the region, and these banners sit directly on top
 * of the notice/table/card styling the suite exists to verify. Suppressing the
 * update state at the source keeps the screens fully visible AND deterministic.
 *
 * @package Attrium
 */

defined( 'ABSPATH' ) || exit;

/**
 * Report "everything is up to date" for core, plugins and themes.
 *
 * Short-circuiting the three update transients removes, in one go:
 *   - the `.update-nag` core banner on every admin screen,
 *   - the 14 `.update-message` overlays on themes.php,
 *   - the `#wp-admin-bar-updates` counter (which Attrium's own header scrapes
 *     via useToolbar, so it would otherwise leak into the shell too),
 *   - `.theme-count` / `.update-plugins` bubble counts.
 *
 * `pre_site_transient_*` runs before any HTTP request, so this also makes the
 * suite fully offline and removes wp.org latency from every page load.
 */
function attrium_visual_freeze_updates() {
	$now = 1700000000; // Fixed timestamp: these are rendered as "checked" times.

	add_filter(
		'pre_site_transient_update_core',
		static function () use ( $now ) {
			return (object) array(
				'updates'         => array(),
				'version_checked' => get_bloginfo( 'version' ),
				'last_checked'    => $now,
			);
		}
	);

	foreach ( array( 'update_plugins', 'update_themes' ) as $transient ) {
		add_filter(
			"pre_site_transient_{$transient}",
			static function () use ( $now ) {
				return (object) array(
					'last_checked' => $now,
					'response'     => array(),
					'translations' => array(),
					'no_update'    => array(),
					'checked'      => array(),
				);
			}
		);
	}
}
attrium_visual_freeze_updates();

/**
 * Give the active theme classic menu support.
 *
 * wp-env activates a block theme (twentytwentyfive), which declares neither
 * `menus` nor `widgets`. nav-menus.php hard-exits with a 500 and the body
 * "Your theme does not support navigation menus or widgets." — so the Menus
 * baseline captured an error page and `scss/screens/_nav-menus.scss` had zero
 * real coverage. Declaring support renders the genuine Menus screen.
 *
 * Runs late so it wins over the theme's own setup callback.
 */
add_action(
	'after_setup_theme',
	static function () {
		add_theme_support( 'menus' );
	},
	100
);

/**
 * Render one deterministic admin notice on every screen.
 *
 * This exists to protect COVERAGE, not to add determinism. Freezing the update
 * transients above removes the `.update-nag` core banner, which on most screens
 * was the only `.notice` in the DOM. Combined with `scss/screens/_base.scss`
 * hiding `.update-nag` outright, the `notices` module (`scss/modules/_notices.scss`)
 * would have almost nothing left to style in a snapshot — and an audit that
 * deletes rules "because the test stayed green" would happily delete it.
 *
 * `.notice` is styled generically (no per-variant rules), so a single fixed,
 * dismissible notice exercises the whole module: the container, `.title`, `p`,
 * and the `.notice-dismiss` button. Text is static so it cannot drift.
 */
add_action(
	'admin_notices',
	static function () {
		echo '<div class="notice notice-info is-dismissible">'
			. '<p class="title">Attrium visual regression</p>'
			. '<p>Fixed notice so the notices module stays under test.</p>'
			. '</div>';
	}
);
