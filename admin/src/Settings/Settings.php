<?php

namespace Attrium\Settings;

defined('ABSPATH') || exit();

class Settings {
    const OPTION_NAME = 'attrium_ignored_urls';

    public function __construct() {
        add_action('admin_menu', [ $this, 'register_menu' ]);
        add_action('rest_api_init', [ $this, 'register_routes' ]);
    }

    public function register_menu(): void {
        add_menu_page(
            __('Attrium', 'attrium'),
            __('Attrium', 'attrium'),
            'manage_options',
            'attrium',
            [ $this, 'render_page' ],
            'dashicons-admin-appearance'
        );

        // Reusing the 'attrium' slug renames the auto-created duplicate first
        // submenu entry to "Appearance", so the menu reads Attrium > Appearance.
        add_submenu_page(
            'attrium',
            __('Appearance', 'attrium'),
            __('Appearance', 'attrium'),
            'manage_options',
            'attrium',
            [ $this, 'render_page' ]
        );
    }

    /**
     * Minimal fallback container. The Attrium Vue app overrides this screen
     * (screen id toplevel_page_attrium) with a native view, so this markup is
     * only what renders if the bundle fails to load.
     */
    public function render_page(): void {
        echo '<div class="wrap"><h1>' . esc_html__('Attrium Appearance', 'attrium') . '</h1></div>';
    }

    public function register_routes(): void {
        register_rest_route(
            'attrium/v1',
            '/ignored-urls',
            [
                [
                    'methods'             => 'GET',
                    'callback'            => [ $this, 'get_ignored_urls' ],
                    'permission_callback' => [ $this, 'can_manage' ],
                ],
                [
                    'methods'             => 'POST',
                    'callback'            => [ $this, 'save_ignored_urls' ],
                    'permission_callback' => [ $this, 'can_manage' ],
                    'args'                => [
                        'urls' => [
                            'type'              => 'string',
                            'required'          => true,
                            'sanitize_callback' => 'sanitize_textarea_field',
                        ],
                    ],
                ],
            ]
        );
    }

    public function can_manage(): bool {
        return current_user_can('manage_options');
    }

    public function get_ignored_urls(): \WP_REST_Response {
        return new \WP_REST_Response(
            [ 'urls' => get_option(self::OPTION_NAME, '') ],
            200
        );
    }

    public function save_ignored_urls( \WP_REST_Request $request ): \WP_REST_Response {
        $urls = (string) $request->get_param('urls');
        update_option(self::OPTION_NAME, $urls);

        return new \WP_REST_Response(
            [ 'urls' => get_option(self::OPTION_NAME, '') ],
            200
        );
    }

    /**
     * Whether the current admin URL matches any user-configured ignore entry.
     *
     * Each non-empty line of the option is treated as a substring: if the
     * current full admin URL contains any line, the page is excluded from
     * Attrium's content styling. Substring matching lets users paste either a
     * full URL or a partial path (e.g. edit.php?post_type=page).
     */
    public static function is_ignored_url(): bool {
        static $cached       = null; // null = uninitialized, false = no match
        static $cached_value = false;

        if ( null !== $cached ) {
            return $cached_value;
        }

        $raw = (string) get_option(self::OPTION_NAME, '');
        if ( '' === trim($raw) ) {
            $cached       = true;
            $cached_value = false;
            return false;
        }

        $host    = isset($_SERVER['HTTP_HOST']) ? sanitize_text_field(wp_unslash($_SERVER['HTTP_HOST'])) : '';
        $uri     = isset($_SERVER['REQUEST_URI']) ? sanitize_text_field(wp_unslash($_SERVER['REQUEST_URI'])) : '';
        $scheme  = is_ssl() ? 'https://' : 'http://';
        $current = $scheme . $host . $uri;

        foreach ( preg_split('/\r\n|\r|\n/', $raw) as $line ) {
            $needle = trim($line);
            if ( '' === $needle ) {
                continue;
            }

            if ( str_contains($current, $needle) ) {
                $cached       = true;
                $cached_value = true;
                return true;
            }
        }

        $cached       = true;
        $cached_value = false;
        return false;
    }
}
