<?php
/**
 * Plugin Name: Attrium Visual-Regression Determinism
 * Description: Test-environment-only shims that make wp-admin byte-stable for visual regression. Mapped into wp-env via .wp-env.json; NEVER shipped with the plugin.
 *
 * Without this, the visual suite is unpinnable: WordPress renders live wp.org
 * update state (core nag, per-theme banners, admin-bar counts) that changes on
 * someone else's release schedule and would break baselines with no CSS change.
 *
 * Masking is strictly worse: a Playwright mask paints an opaque box over the
 * region, and these banners sit on top of the notice/table/card styling the
 * suite exists to verify. Suppressing the state at the source keeps the
 * screens fully visible AND deterministic.
 *
 * @package Attrium
 */

defined( 'ABSPATH' ) || exit;

/**
 * Report "everything is up to date" for core, plugins and themes.
 *
 * Removes the `.update-nag` banner, the themes.php `.update-message`
 * overlays, the `#wp-admin-bar-updates` counter (scraped into Attrium's own
 * header via useToolbar) and the bubble counts — before any HTTP request,
 * so the suite is also fully offline with no wp.org latency.
 */
function attrium_visual_freeze_updates() {
    $now = 1700000000; // Fixed "checked" time.

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
 * wp-env's block theme declares no `menus`, so nav-menus.php 500s and the
 * baseline captured an error page. Runs late to win over the theme's setup.
 */
add_action(
    'after_setup_theme',
    static function () {
        add_theme_support( 'menus' );
    },
    100
);

/**
 * Give the Menus screen a real, fixed menu to edit.
 *
 * A fresh install has no menus, so the `.menu-item-*` rows this SCSS styles
 * never render. Two custom links exercise hierarchy with no post objects.
 *
 * Claimed with `add_option`, not a read-then-create check: parallel workers
 * race here, and only an INSERT against the UNIQUE key is atomic — exactly
 * one caller seeds, the rest return. Released on failure so a later request
 * retries instead of leaving a claim with no menu behind it.
 */
add_action(
    'admin_init',
    static function () {
        if ( ! current_user_can( 'edit_theme_options' ) ) {
            return;
        }

        if ( ! add_option( 'attrium_visual_menu_seeded', '1' ) ) {
            return;
        }

        $menu_id = wp_create_nav_menu( 'Attrium Menu' );
        if ( is_wp_error( $menu_id ) ) {
            delete_option( 'attrium_visual_menu_seeded' );
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
 * Seed the Media Library grid with ten fixed attachments.
 *
 * A fresh install has an empty library, so the tiles, the .filename caption
 * and the check chip had no coverage. Nine copies of one PNG fill two rows
 * (whatever column count the viewport picks); core's pipeline generates the
 * thumbnails from a fixed source, so they are byte-identical across runs.
 *
 * The tenth is a long-filename PDF: non-image tiles are the one place 6.7
 * renders .filename (7.1 paints image names on li::after), and the name
 * overflows one tile width, exercising the ellipsis truncation.
 *
 * Two modal pins (clicking the FIRST tile opens "Attachment details"):
 * subdirectory pinned to 2024/01 (the modal renders full File URLs) and
 * distinct hourly dates on 2024-01-01 (the grid sorts date DESC; ties fall
 * to MySQL's unspecified order, so fixture 1 must win by sort alone).
 *
 * Claimed atomically like the menu fixture (parallel workers race
 * admin_init); released on failure so a later request retries.
 */

/**
 * Pin fixture uploads into uploads/2024/01 (see above: the modal renders
 * full upload paths, so a date-derived subdir would leak into baselines).
 *
 * @param array $uploads The upload dir configuration.
 * @return array
 */
function attrium_visual_pin_upload_subdir( $uploads ) {
    $uploads['subdir'] = '/2024/01';
    $uploads['path']   = $uploads['basedir'] . $uploads['subdir'];
    $uploads['url']    = $uploads['baseurl'] . $uploads['subdir'];

    return $uploads;
}

add_action(
    'admin_init',
    static function () {
        if ( ! current_user_can( 'upload_files' ) ) {
            return;
        }

        if ( ! add_option( 'attrium_visual_media_seeded', '1' ) ) {
            return;
        }

        $source = __DIR__ . '/attrium-visual-fixture.png';
        $bytes  = is_readable( $source ) ? file_get_contents( $source ) : false;

        if ( ! is_string( $bytes ) ) {
            delete_option( 'attrium_visual_media_seeded' );
            return;
        }

        $success = true;

        add_filter( 'upload_dir', 'attrium_visual_pin_upload_subdir' );

        for ( $i = 1; $success && $i <= 9; $i++ ) {
            $upload = wp_upload_bits( "attrium-visual-fixture-{$i}.png", null, $bytes );

            if ( ! is_array( $upload ) || ! empty( $upload['error'] ) ) {
                $success = false;
                break;
            }

            $attachment_id = wp_insert_attachment(
                array(
                    'post_mime_type' => 'image/png',
                    'post_title'     => "Attrium Fixture {$i}",
                    'post_status'    => 'inherit',
                    'post_date'      => sprintf( '2024-01-01 %02d:00:00', 13 - $i ),
                    'post_date_gmt'  => sprintf( '2024-01-01 %02d:00:00', 13 - $i ),
                ),
                $upload['file']
            );

            if ( is_wp_error( $attachment_id ) || 0 === $attachment_id ) {
                $success = false;
                break;
            }

            wp_update_attachment_metadata(
                $attachment_id,
                wp_generate_attachment_metadata( $attachment_id, $upload['file'] )
            );
        }

        // Long-filename PDF caption fixture; oldest date, so the LAST tile.
        if ( $success ) {
            $upload = wp_upload_bits(
                'attrium-visual-fixture-with-a-very-long-filename.pdf',
                null,
                $bytes
            );

            if ( ! is_array( $upload ) || ! empty( $upload['error'] ) ) {
                $success = false;
            } else {
                $attachment_id = wp_insert_attachment(
                    array(
                        'post_mime_type' => 'application/pdf',
                        'post_title'     => 'Attrium Fixture 10',
                        'post_status'    => 'inherit',
                        'post_date'      => '2024-01-01 03:00:00',
                        'post_date_gmt'  => '2024-01-01 03:00:00',
                    ),
                    $upload['file']
                );

                if ( is_wp_error( $attachment_id ) || 0 === $attachment_id ) {
                    $success = false;
                } else {
                    wp_update_attachment_metadata(
                        $attachment_id,
                        wp_generate_attachment_metadata( $attachment_id, $upload['file'] )
                    );
                }
            }
        }

        remove_filter( 'upload_dir', 'attrium_visual_pin_upload_subdir' );

        if ( ! $success ) {
            delete_option( 'attrium_visual_media_seeded' );
        }
    }
);

/**
 * Ensure multiple active sessions so profile.php's "Log Out Everywhere
 * Else" stays enabled with its longer two-line text (~21px the baselines
 * expect). A fresh install has one session token, which disables the button
 * and shortens the copy.
 *
 * Safe under parallel workers: the injected key is fixed, so concurrent
 * writers converge on the same array; nothing else writes this meta mid-run
 * (auth.setup.ts logs in once, workers reuse the stored session).
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
 * It depends on wp-env startup timing, flipping the page between 3 and 4
 * recommendations across runs. Everything else stays fully covered.
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
 * Protects COVERAGE, not determinism: freezing updates removes the
 * `.update-nag` banner (often the only `.notice` in the DOM), which would
 * leave the notices module with nothing under test. One fixed dismissible
 * notice exercises container, title, paragraph and dismiss button; the text
 * is static so it cannot drift.
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
 * Stub the wp.org Plugin Installation API with three fixed plugins.
 *
 * plugin-install.php renders live results that change on wp.org's schedule.
 * A fixed catalog makes it deterministic and offline while covering every
 * card state: fully populated, zero rating/installs (no stars, "Less Than
 * 10"), and incompatible (WP 99.0 / PHP 9.9 → error notice, no button).
 *
 * Icons point at a local wp-admin asset (no network, no remote drift); the
 * hook only runs on plugin-install.php. The Featured tab's tag cloud is
 * pinned too — `hot_tags` is stubbed AND its `poptags_` transient pre-seeded
 * (keyed exactly like core) so a stale live fetch can't leak through.
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
 * Stub the wp.org Theme Installation API with three fixed themes.
 *
 * Same shape as the plugin stub: populated, zero rating/installs, and low
 * rating (single gold star). Screenshots point at a local asset; only
 * `query_themes` runs on the server render (`theme_information` is
 * client-fetched for the Details overlay, outside the snapshot).
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
 * Pre-seed the `poptags_` transient install_popular_tags() caches, keyed
 * exactly like core, so the tag cloud never reaches the network.
 */
add_filter(
    'pre_site_transient_poptags_' . md5( serialize( array() ) ),
    static function () {
        return attrium_visual_hot_tags();
    }
);
