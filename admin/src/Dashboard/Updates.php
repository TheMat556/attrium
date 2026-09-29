<?php
/**
 * WordPress-native update inventory for the dashboard.
 *
 * @package Attrium
 */

namespace Attrium\Dashboard;

defined('ABSPATH') || exit();

/**
 * Reads core/plugin/theme updates straight from WordPress.
 *
 * WordPress exposes no security-vs-regular classification out of the box.
 * Rather than invent certainty we don't have, the one signal core itself
 * trusts is reused: a core minor/patch release is treated as security-relevant
 * (this mirrors WP_Site_Health::get_test_wordpress_version()), while plugin,
 * theme and core major updates are regular. Real vulnerability data (WPScan et
 * al.) is deliberately deferred to v2.
 */
class Updates {
    /**
     * @return array<string, mixed>
     */
    public static function get(): array {
        if ( ! function_exists('get_plugins') ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        if ( ! function_exists('get_plugin_updates') ) {
            require_once ABSPATH . 'wp-admin/includes/update.php';
        }

        $security = [];
        $regular  = [];

        $core = self::core_update();
        if ( null !== $core ) {
            if ( Severity::CRITICAL === $core['severity'] ) {
                $security[] = $core;
            } else {
                $regular[] = $core;
            }
        }

        foreach ( self::plugin_updates() as $item ) {
            $regular[] = $item;
        }

        foreach ( self::theme_updates() as $item ) {
            $regular[] = $item;
        }

        $severities = array_merge(
            array_column($security, 'severity'),
            array_column($regular, 'severity'),
        );

        return [
            'severity' => Severity::worst($severities),
            'total'    => count($security) + count($regular),
            'security' => $security,
            'regular'  => $regular,
        ];
    }

    /**
     * The newest available core release, or null when up to date.
     *
     * @return array<string, mixed>|null
     */
    private static function core_update(): ?array {
        $updates = function_exists('get_core_updates') ? get_core_updates() : null;

        if ( ! is_array($updates) ) {
            return null;
        }

        foreach ( $updates as $update ) {
            if ( ! isset($update->response) || 'upgrade' !== $update->response ) {
                continue;
            }

            $current = isset($update->current) ? (string) $update->current : get_bloginfo('version');
            $new     = isset($update->version) ? (string) $update->version : '';

            if ( '' === $new ) {
                continue;
            }

            $current_parts = explode('.', $current);
            $new_parts     = explode('.', $new);
            $current_minor = implode('.', array_slice($current_parts, 0, 2));
            $new_minor     = implode('.', array_slice($new_parts, 0, 2));

            return [
                'type'      => 'core',
                'name'      => __('WordPress', 'attrium'),
                'current'   => $current,
                'new'       => $new,
                // A same-branch release is the security-sensitive case.
                'severity'  => $current_minor === $new_minor ? Severity::CRITICAL : Severity::WARNING,
                'actionUrl' => admin_url('update-core.php'),
            ];
        }

        return null;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private static function plugin_updates(): array {
        $items   = [];
        $updates = function_exists('get_plugin_updates') ? get_plugin_updates() : [];

        foreach ( (array) $updates as $plugin_file => $plugin ) {
            // Cast to arrays: WP_Plugin data uses capitalised keys and the
            // snake_case sniff cannot be satisfied by property access.
            $data   = (array) $plugin;
            $update = isset($plugin->update) ? (array) $plugin->update : [];
            $new    = isset($update['new_version']) ? (string) $update['new_version'] : '';

            if ( '' === $new ) {
                continue;
            }

            $items[] = [
                'type'      => 'plugin',
                'name'      => isset($data['Name']) ? (string) $data['Name'] : (string) $plugin_file,
                'current'   => isset($data['Version']) ? (string) $data['Version'] : '',
                'new'       => $new,
                // No vulnerability feed in v1 — treat as routine, never alarm.
                'severity'  => Severity::WARNING,
                'actionUrl' => admin_url('plugins.php'),
            ];
        }

        return $items;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private static function theme_updates(): array {
        $items   = [];
        $updates = function_exists('get_theme_updates') ? get_theme_updates() : [];

        foreach ( (array) $updates as $theme ) {
            if ( ! is_object($theme) || ! isset($theme->update) ) {
                continue;
            }

            $update = $theme->update;
            $new    = '';

            if ( is_array($update) && isset($update['new_version']) ) {
                $new = (string) $update['new_version'];
            } elseif ( is_object($update) && isset($update->new_version) ) {
                $new = (string) $update->new_version;
            }

            if ( '' === $new ) {
                continue;
            }

            $name = method_exists($theme, 'get') ? (string) $theme->get('Name') : '';

            $items[] = [
                'type'      => 'theme',
                'name'      => '' !== $name ? $name : __('Theme', 'attrium'),
                'current'   => method_exists($theme, 'get') ? (string) $theme->get('Version') : '',
                'new'       => $new,
                'severity'  => Severity::WARNING,
                'actionUrl' => admin_url('themes.php'),
            ];
        }

        return $items;
    }
}
