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
 * Give the active theme classic menu + widget support.
 *
 * wp-env activates a block theme (twentytwentyfive), which declares neither
 * `menus` nor `widgets`. nav-menus.php hard-exits with a 500 and the body
 * "Your theme does not support navigation menus or widgets." — so the Menus
 * baseline captured an error page and `scss/screens/_nav-menus.scss` had zero
 * real coverage. Declaring support renders the genuine Menus screen.
 *
 * widgets.php hard-exits the same way (wp_die "not widget-aware") when
 * `current_theme_supports('widgets')` is false, so a fresh-install block theme
 * would render an error page and the Widgets capture would never reach the
 * block editor (`.edit-widgets-header__title`). Declaring support routes it
 * into widgets-form-blocks.php via wp_use_widgets_block_editor().
 *
 * Runs late so it wins over the theme's own setup callback.
 */
add_action(
    'after_setup_theme',
    static function () {
        add_theme_support( 'menus' );
        add_theme_support( 'widgets' );
    },
    100
);

/**
 * Give the Menus screen a real, fixed menu to edit.
 *
 * a fresh install has "no menus", so nav-menus.php renders only the
 * `#menu-settings-column` "add items" panels and an empty `#menu-management`
 * "Menu structure" box — `.menu-item` / `.menu-item-handle` /
 * `.menu-item-settings` rows never exist, and `_nav-menus.scss` has no rule for
 * them (they'd keep core's #fff chrome and read as a white band when a real
 * menu has items). Creating one deterministic menu fixtures the structure box
 * so those rules can be written and the baseline can lock them down.
 *
 * Guarded by name so the (test-only) menu is created once and left untouched on
 * subsequent loads; two custom-link items keep the row markup exercising a
 * hierarchy with no dependence on post objects existing.
 */
add_action(
    'admin_init',
    static function () {
        if ( ! current_user_can( 'edit_theme_options' ) ) {
            return;
        }

        $menu_name = 'Attrium Menu';

        if ( wp_get_nav_menu_object( $menu_name ) ) {
            return;
        }

        $menu_id = wp_create_nav_menu( $menu_name );
        if ( is_wp_error( $menu_id ) ) {
            return;
        }

        $items = array(
            array( 'title' => 'Home', 'url' => 'https://example.com/' ),
            array( 'title' => 'About', 'url' => 'https://example.com/about/' ),
        );

        foreach ( $items as $position => $item ) {
            wp_update_nav_menu_item(
                $menu_id,
                0,
                array(
                    'menu-item-title'    => $item['title'],
                    'menu-item-url'      => $item['url'],
                    'menu-item-status'   => 'publish',
                    'menu-item-type'     => 'custom',
                    'menu-item-position' => $position + 1,
                )
            );
        }
    }
);

/**
 * Ensure multiple active sessions so the "Log Out Everywhere Else" button
 * on profile.php / user-edit.php is always enabled with the longer text.
 *
 * A fresh wp-env install has exactly one session token. WordPress disables
 * the button and shortens the description to "You are only logged in at
 * this location." when there is only one session. The longer variant
 * ("Did you lose your phone…") wraps to two lines, adding ~21 px of
 * height that the committed baselines expect.  Injecting a second session
 * token keeps the button enabled and the text stable across environments.
 */
add_action(
    'admin_init',
    static function () {
        if ( ! current_user_can( 'read' ) ) {
            return;
        }

        $user = wp_get_current_user();
        if ( ! $user || ! $user->exists() ) {
            return;
        }

        $tokens = get_user_meta( $user->ID, 'session_tokens', true );
        if ( ! is_array( $tokens ) ) {
            $tokens = array();
        }
        if ( count( $tokens ) < 2 ) {
            $tokens['visual-regression-fake-session'] = array(
                'expiration' => time() + YEAR_IN_SECONDS,
            );
            update_user_meta( $user->ID, 'session_tokens', $tokens );
        }
    }
);

/**
 * Remove the "scheduled events" site-health test.
 *
 * This test checks WP-Cron health and reports "A scheduled event has failed"
 * when a cron job errors. Whether it fires depends on the wp-env startup
 * timing and is not deterministic, causing the site-health page to show
 * 3 or 4 recommended improvements between runs.  Removing it keeps the
 * screen stable while leaving every other site-health check (inactive
 * plugins/themes, debug mode, loopback, etc.) fully covered.
 */
add_filter(
    'site_status_tests',
    static function ( $tests ) {
        unset( $tests['direct']['scheduled_events'] );
        return $tests;
    }
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
            . '<p class="title">' . esc_html__( 'Attrium visual regression', 'attrium' ) . '</p>'
            . '<p>' . esc_html__( 'Fixed notice so the notices module stays under test.', 'attrium' ) . '</p>'
            . '</div>';
    }
);

/**
 * Stub the WordPress.org Plugin Installation API with three fixed plugins.
 *
 * plugin-install.php renders live wp.org results ("Featured", search, …) that
 * change on WordPress.org's schedule, so without this stub it cannot be in the
 * page suite. Short-circuiting `plugins_api` with a fixed catalog makes the
 * screen deterministic and offline while exercising every card state the SCSS
 * touches:
 *   - fixture-card-one:   fully populated (rating stars, installs, updated) →
 *                         the normal card layout,
 *   - fixture-card-two:   zero rating / zero installs → no stars, "Less Than
 *                         10" installs text,
 *   - fixture-card-three: requires WP 99.0 / PHP 9.9 → the incompatible card
 *                         with its error notice and no Install button.
 *
 * The plugin icon points at a local wp-admin asset so the card renders with no
 * network round-trip and no remote-image drift. `plugins_api` runs only on
 * plugin-install.php (and the install-plugin flow), so no other screen is
 * affected.
 *
 * The Featured tab's "Popular tags" cloud is pinned too: `install_popular_tags()`
 * calls `plugins_api( 'hot_tags' )` and caches the result in a `poptags_` site
 * transient keyed by `md5( serialize( $args ) )` (empty args on the Featured
 * tab). We stub `hot_tags` here AND pre-seed that transient so a stale live
 * fetch cached by an earlier run cannot leak through before its 3-hour TTL.
 */
function attrium_visual_hot_tags() {
    return array(
        array( 'name' => 'accessibility', 'slug' => 'accessibility', 'count' => 542 ),
        array( 'name' => 'admin', 'slug' => 'admin', 'count' => 2937 ),
        array( 'name' => 'analytics', 'slug' => 'analytics', 'count' => 1406 ),
        array( 'name' => 'cache', 'slug' => 'cache', 'count' => 534 ),
        array( 'name' => 'chat', 'slug' => 'chat', 'count' => 876 ),
        array( 'name' => 'ecommerce', 'slug' => 'ecommerce', 'count' => 1897 ),
        array( 'name' => 'gallery', 'slug' => 'gallery', 'count' => 1467 ),
        array( 'name' => 'gutenberg', 'slug' => 'gutenberg', 'count' => 1411 ),
        array( 'name' => 'seo', 'slug' => 'seo', 'count' => 3064 ),
        array( 'name' => 'shortcode', 'slug' => 'shortcode', 'count' => 2343 ),
        array( 'name' => 'video', 'slug' => 'video', 'count' => 1140 ),
        array( 'name' => 'widget', 'slug' => 'widget', 'count' => 5098 ),
        array( 'name' => 'woocommerce', 'slug' => 'woocommerce', 'count' => 10529 ),
    );
}

add_filter(
    'plugins_api',
    static function ( $result, $action, $args ) {
        if ( 'hot_tags' === $action ) {
            return attrium_visual_hot_tags();
        }

        if ( 'query_plugins' !== $action && 'search' !== $action ) {
            return $result;
        }

        $fixture = static function ( $name, $slug, $version, $author, $rating, $num_ratings, $active_installs, $last_updated, $requires = '6.0', $requires_php = '7.2' ) {
            $author_slug = sanitize_title( $author );

            return (object) array(
                'name'              => $name,
                'slug'              => $slug,
                'version'           => $version,
                'author'            => sprintf( '<a href="https://example.com/%1$s">%2$s</a>', $author_slug, $author ),
                'author_profile'    => 'https://example.com/' . $author_slug,
                'contributors'      => array( $author_slug => array( 'profile' => 'https://example.com/' . $author_slug, 'avatar' => '', 'display_name' => $author ) ),
                'requires'          => $requires,
                'requires_php'      => $requires_php,
                'tested'            => '6.7',
                'requires_plugins'  => array(),
                'rating'            => $rating,
                'num_ratings'       => $num_ratings,
                'ratings'           => array( 5 => 0, 4 => 0, 3 => 0, 2 => 0, 1 => 0 ),
                'active_installs'   => $active_installs,
                'last_updated'      => $last_updated,
                'added'             => '2024-01-01',
                'homepage'          => 'https://example.com/' . $slug,
                'sections'          => array(
                    'description' => 'Fixture description for ' . $name . '.',
                    'changelog'   => '1.0.0 – Initial release.',
                ),
                'short_description' => 'Fixture short description for ' . $name . '.',
                'download_link'     => 'https://example.com/' . $slug . '.zip',
                'tags'              => array(),
                'donate_link'       => '',
                'icons'             => array( 'default' => admin_url( 'images/wordpress-logo.svg' ) ),
                'banners'           => array(),
                'banner_2x'         => '',
            );
        };

        return (object) array(
            'info'    => array(
                'page'    => 1,
                'pages'   => 1,
                'results' => 3,
            ),
            'plugins' => array(
                $fixture( 'Fixture Card One', 'fixture-card-one', '1.2.3', 'A. Author', 96, 137, 20000, '2026-01-15 8:00am' ),
                $fixture( 'Fixture Card Two', 'fixture-card-two', '0.9.1', 'B. Author', 0, 0, 0, '2025-11-02 8:00am' ),
                $fixture( 'Fixture Card Three', 'fixture-card-three', '2.0.0', 'C. Author', 70, 42, 1200, '2025-06-30 8:00am', '99.0', '9.9' ),
            ),
        );
    },
    10,
    3
);

/**
 * Stub the WordPress.org Theme Installation API with three fixed themes.
 *
 * Mirrors the plugins_api stub above: theme-install.php renders live wp.org
 * results ("Featured", search, …) that change on WordPress.org's schedule.
 * Short-circuiting `themes_api` makes the grid deterministic and offline while
 * exercising the card states the SCSS touches:
 *   - fixture-theme-one:   fully populated (rating stars, installs) → the
 *                         normal card layout,
 *   - fixture-theme-two:   zero rating / zero installs → no stars,
 *   - fixture-theme-three: low rating → a single gold star.
 *
 * The screenshot points at a local wp-admin asset so the card renders with no
 * network round-trip and no remote-image drift. Only `query_themes` runs on the
 * initial server render of theme-install.php
 * (class-wp-theme-install-list-table.php); `theme_information` is fetched by
 * the client when the Details overlay opens and is not part of the snapshot.
 */
add_filter(
    'themes_api',
    static function ( $result, $action, $args ) {
        if ( 'query_themes' !== $action ) {
            return $result;
        }

        $fixture = static function ( $name, $slug, $version, $author, $rating, $num_ratings, $downloaded ) {
            return (object) array(
                'name'           => $name,
                'slug'           => $slug,
                'version'        => $version,
                'author'         => array(
                    'display_name' => $author,
                    'profile'      => 'https://example.com/' . sanitize_title( $author ),
                ),
                'rating'         => $rating,
                'num_ratings'    => $num_ratings,
                'downloaded'     => $downloaded,
                'last_updated'   => '2026-01-15 8:00am',
                'requires'       => '6.0',
                'requires_php'   => '7.2',
                'homepage'       => 'https://example.com/' . $slug,
                'preview_url'    => 'https://example.com/' . $slug,
                'screenshot_url' => admin_url( 'images/wordpress-logo.svg' ),
                'description'    => 'Fixture description for ' . $name . '.',
                'download_link'  => 'https://example.com/' . $slug . '.zip',
            );
        };

        return (object) array(
            'info'   => array(
                'page'    => 1,
                'pages'   => 1,
                'results' => 3,
            ),
            'themes' => array(
                $fixture( 'Fixture Theme One', 'fixture-theme-one', '1.0.0', 'A. Author', 92, 87, 3000 ),
                $fixture( 'Fixture Theme Two', 'fixture-theme-two', '0.8.0', 'B. Author', 0, 0, 0 ),
                $fixture( 'Fixture Theme Three', 'fixture-theme-three', '2.1.0', 'C. Author', 64, 22, 900 ),
            ),
        );
    },
    10,
    3
);

/**
 * Pre-seed the `poptags_` site transient that install_popular_tags() caches.
 *
 * Keyed exactly like core (`md5( serialize( $args ) )` with empty args on the
 * Featured tab) so get_site_transient() short-circuits to the fixed tag set and
 * never reaches the wp.org network, even if a previous run cached live tags.
 * `install_dashboard()` calls `install_popular_tags()` with no args, so the
 * transient stores the full tag array (core reads `$tag['name']` per tag).
 */
add_filter(
    'pre_site_transient_poptags_' . md5( serialize( array() ) ),
    static function () {
        return attrium_visual_hot_tags();
    }
);
