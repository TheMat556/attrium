<?php
/**
 * Dashboard data aggregator.
 *
 * @package Attrium
 */

namespace Attrium\Dashboard;

defined('ABSPATH') || exit();

/**
 * Joins the local, WordPress-native sections into one payload.
 *
 * GA4 and UptimeRobot are fetched separately because they are slow and
 * independently cached; this keeps the first paint fast even when an external
 * API is unavailable.
 */
class Data {
    /**
     * The WordPress-native summary.
     *
     * @param bool $refresh Re-run the Site Health cache.
     * @return array<string, mixed>
     */
    public static function summary( bool $refresh = false ): array {
        return [
            'generatedAt' => time(),
            'updates'     => Updates::get(),
            'siteHealth'  => SiteHealth::get($refresh),
            'backup'      => Backup::get(),
            'advanced'    => self::advanced(),
        ];
    }

    /**
     * Advanced-mode technical details.
     *
     * @return array<string, mixed>
     */
    public static function advanced(): array {
        global $wpdb;

        if ( ! function_exists('get_plugins') ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        $server = isset($_SERVER['SERVER_SOFTWARE'])
            ? sanitize_text_field(wp_unslash($_SERVER['SERVER_SOFTWARE']))
            : '';

        return [
            'wpVersion'         => get_bloginfo('version'),
            'phpVersion'        => PHP_VERSION,
            'serverSoftware'    => $server,
            'mysqlVersion'      => is_object($wpdb) ? (string) $wpdb->db_version() : '',
            'environment'       => function_exists('wp_get_environment_type') ? wp_get_environment_type() : '',
            'pluginCount'       => count( (array) get_plugins()),
            'pluginActiveCount' => count( (array) get_option('active_plugins', [])),
            'themeCount'        => count(wp_get_themes()),
            'memoryLimit'       => defined('WP_MEMORY_LIMIT') ? WP_MEMORY_LIMIT : '',
            'maxUploadSize'     => size_format(wp_max_upload_size()),
            'debugMode'         => defined('WP_DEBUG') && WP_DEBUG,
        ];
    }
}
