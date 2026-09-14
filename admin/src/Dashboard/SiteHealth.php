<?php
/**
 * WordPress Site Health adapter for the dashboard.
 *
 * @package Attrium
 */

namespace Attrium\Dashboard;

defined('ABSPATH') || exit();

/**
 * Runs the same tests behind Tools → Site Health and re-groups them.
 *
 * Only the `direct` test group is run: the `async` group performs authenticated
 * loopback HTTP requests (wordpress.org ping, REST availability, page cache)
 * that would make a dashboard load slow and network-dependent. SSL is still
 * covered by the direct `ssl_support` test. The whole result is cached so the
 * checks run at most once per window.
 */
class SiteHealth {
    const CACHE_KEY = 'attrium_dashboard_site_health';
    const CACHE_TTL = 6 * HOUR_IN_SECONDS;

    const CATEGORY_SECURITY    = 'security';
    const CATEGORY_PERFORMANCE = 'performance';
    const CATEGORY_CONTENT     = 'content';

    /**
     * Test id => dashboard category.
     */
    private const CATEGORIES = [
        'wordpress_version'            => self::CATEGORY_SECURITY,
        'plugin_version'               => self::CATEGORY_SECURITY,
        'theme_version'                => self::CATEGORY_SECURITY,
        'ssl_support'                  => self::CATEGORY_SECURITY,
        'insecure_registration'        => self::CATEGORY_SECURITY,
        'debug_enabled'                => self::CATEGORY_SECURITY,
        'file_uploads'                 => self::CATEGORY_SECURITY,
        'background_updates'           => self::CATEGORY_SECURITY,
        'dotorg_communication'         => self::CATEGORY_SECURITY,
        'https_status'                 => self::CATEGORY_SECURITY,
        'authorization_header'         => self::CATEGORY_SECURITY,
        'php_version'                  => self::CATEGORY_PERFORMANCE,
        'php_extensions'               => self::CATEGORY_PERFORMANCE,
        'php_default_timezone'         => self::CATEGORY_PERFORMANCE,
        'php_sessions'                 => self::CATEGORY_PERFORMANCE,
        'sql_server'                   => self::CATEGORY_PERFORMANCE,
        'scheduled_events'             => self::CATEGORY_PERFORMANCE,
        'http_requests'                => self::CATEGORY_PERFORMANCE,
        'rest_availability'            => self::CATEGORY_PERFORMANCE,
        'page_cache'                   => self::CATEGORY_PERFORMANCE,
        'persistent_object_cache'      => self::CATEGORY_PERFORMANCE,
        'opcode_cache'                 => self::CATEGORY_PERFORMANCE,
        'autoloaded_options'           => self::CATEGORY_PERFORMANCE,
        'available_updates_disk_space' => self::CATEGORY_PERFORMANCE,
        'update_temp_backup_writable'  => self::CATEGORY_PERFORMANCE,
        'loopback_requests'            => self::CATEGORY_PERFORMANCE,
        'search_engine_visibility'     => self::CATEGORY_CONTENT,
    ];

    /**
     * Friendlier headings than WordPress's raw test labels.
     */
    private const LABELS = [
        'wordpress_version'            => 'WordPress is up to date',
        'plugin_version'               => 'Plugins are up to date',
        'theme_version'                => 'Themes are up to date',
        'ssl_support'                  => 'Secure connection support',
        'insecure_registration'        => 'Registration is safe',
        'debug_enabled'                => 'Debug mode is off',
        'file_uploads'                 => 'File uploads work',
        'php_version'                  => 'PHP version',
        'php_extensions'               => 'Required PHP modules',
        'php_default_timezone'         => 'PHP timezone',
        'php_sessions'                 => 'PHP sessions',
        'sql_server'                   => 'Database server',
        'scheduled_events'             => 'Scheduled tasks',
        'http_requests'                => 'Outbound requests',
        'rest_availability'            => 'REST API availability',
        'page_cache'                   => 'Page caching',
        'persistent_object_cache'      => 'Object caching',
        'opcode_cache'                 => 'Opcode caching',
        'autoloaded_options'           => 'Autoloaded options',
        'available_updates_disk_space' => 'Free disk space',
        'update_temp_backup_writable'  => 'Temporary backup directory',
        'search_engine_visibility'     => 'Search engine visibility',
    ];

    /**
     * @param bool $refresh Skip the transient and re-run the tests.
     * @return array<string, mixed>
     */
    public static function get( bool $refresh = false ): array {
        if ( ! $refresh ) {
            $cached = get_transient(self::CACHE_KEY);

            if ( is_array($cached) ) {
                return $cached;
            }
        }

        $result = self::run();

        set_transient(self::CACHE_KEY, $result, self::CACHE_TTL);

        return $result;
    }

    /**
     * @return array<string, mixed>
     */
    private static function run(): array {
        if ( ! class_exists('WP_Site_Health') ) {
            require_once ABSPATH . 'wp-admin/includes/class-wp-site-health.php';
        }

        if ( ! function_exists('get_plugins') ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        if ( ! function_exists('get_core_updates') ) {
            require_once ABSPATH . 'wp-admin/includes/update.php';
        }

        if ( ! function_exists('wp_is_site_protected_by_basic_auth') ) {
            require_once ABSPATH . 'wp-admin/includes/misc.php';
        }

        $instance = \WP_Site_Health::get_instance();
        $tests    = \WP_Site_Health::get_tests();
        $direct   = isset($tests['direct']) && is_array($tests['direct']) ? $tests['direct'] : [];

        $items = [];

        foreach ( $direct as $id => $test ) {
            if ( ! is_array($test) || ! isset($test['test']) ) {
                continue;
            }

            $result = self::run_test($instance, $test['test']);

            if ( null === $result ) {
                continue;
            }

            $items[] = self::normalize( (string) $id, $result);
        }

        return self::group($items);
    }

    /**
     * Run one direct test, returning null rather than letting a bad test 500.
     *
     * @param \WP_Site_Health $instance The singleton.
     * @param string|callable $test     A method suffix or a callable.
     * @return array<string, mixed>|null
     */
    private static function run_test( $instance, $test ): ?array {
        try {
            if ( is_callable($test) ) {
                $result = call_user_func($test);
            } else {
                $method = 'get_test_' . (string) $test;

                if ( ! method_exists($instance, $method) ) {
                    return null;
                }

                $result = $instance->{$method}();
            }
        } catch ( \Throwable $e ) {
            return null;
        }

        return is_array($result) ? $result : null;
    }

    /**
     * @param string               $id     Test identifier.
     * @param array<string, mixed> $result Raw test result.
     * @return array<string, mixed>
     */
    private static function normalize( string $id, array $result ): array {
        $status    = isset($result['status']) ? (string) $result['status'] : 'good';
        $raw_label = isset($result['label']) ? (string) $result['label'] : $id;

        // The friendly heading only replaces core's label when the test passed.
        // For a recommendation/critical, core's own label names the actual
        // problem ("You should remove inactive plugins") and a friendly
        // "Plugins are up to date" would contradict the severity badge.
        $label = ( 'good' === $status && isset(self::LABELS[ $id ]) )
            ? self::LABELS[ $id ]
            : $raw_label;

        $badge    = isset($result['badge']['label']) ? (string) $result['badge']['label'] : '';
        $category = isset(self::CATEGORIES[ $id ]) ? self::CATEGORIES[ $id ] : self::CATEGORY_PERFORMANCE;

        return [
            'id'          => $id,
            'category'    => $category,
            'label'       => $label,
            'severity'    => Severity::from_status($status),
            'badge'       => $badge,
            'description' => self::plain($result['description'] ?? ''),
            'actionUrl'   => self::action_url($result['actions'] ?? ''),
            'actionLabel' => self::action_label($result['actions'] ?? ''),
        ];
    }

    /**
     * Reduce a test's HTML description to one plain sentence.
     *
     * Core appends the test-specific detail as the LAST paragraph (e.g. how
     * many inactive plugins there are), after a generic explanation paragraph.
     * Picking that final paragraph is what makes the line actionable instead
     * of boilerplate.
     */
    private static function plain( $html ): string {
        if ( ! is_string($html) || '' === $html ) {
            return '';
        }

        $text = $html;

        if ( preg_match_all('/<p[^>]*>(.*?)<\/p>/is', $html, $matches) && ! empty($matches[1]) ) {
            $text = (string) end($matches[1]);
        }

        $text = wp_strip_all_tags($text, true);

        $charset = get_bloginfo('charset');
        if ( '' === $charset ) {
            $charset = 'UTF-8';
        }

        $text = html_entity_decode($text, ENT_QUOTES, $charset);
        $text = trim( (string) preg_replace('/\s+/', ' ', $text));

        if ( strlen($text) <= 200 ) {
            return $text;
        }

        $cut  = substr($text, 0, 200);
        $last = strrpos($cut, ' ');

        return ( false !== $last ? substr($cut, 0, $last) : $cut ) . '…';
    }

    /**
     * The first same-site link in a test's actions HTML, or null.
     */
    private static function action_url( $html ): ?string {
        if ( ! is_string($html) || '' === $html ) {
            return null;
        }

        if ( ! preg_match('/<a[^>]+href=["\']([^"\']+)["\']/i', $html, $matches) ) {
            return null;
        }

        $url = esc_url_raw(html_entity_decode($matches[1], ENT_QUOTES));

        if ( '' === $url ) {
            return null;
        }

        $home_host = wp_parse_url(home_url(), PHP_URL_HOST);
        $url_host  = wp_parse_url($url, PHP_URL_HOST);

        // Relative admin links (no host) and same-host links are trusted.
        if ( empty($url_host) || $url_host === $home_host ) {
            return $url;
        }

        return null;
    }

    /**
     * The visible anchor text for the primary action, or null.
     */
    private static function action_label( $html ): ?string {
        if ( ! is_string($html) || '' === $html ) {
            return null;
        }

        if ( ! preg_match('/<a[^>]*>(.*?)<\/a>/is', $html, $matches) ) {
            return null;
        }

        $label = trim(wp_strip_all_tags($matches[1]));

        return '' !== $label ? $label : null;
    }

    /**
     * @param array<int, array<string, mixed>> $items Normalized items.
     * @return array<string, mixed>
     */
    private static function group( array $items ): array {
        $categories = [
            self::CATEGORY_SECURITY    => [
                'id'    => self::CATEGORY_SECURITY,
                'label' => __('Security', 'attrium'),
                'items' => [],
            ],
            self::CATEGORY_PERFORMANCE => [
                'id'    => self::CATEGORY_PERFORMANCE,
                'label' => __('Performance', 'attrium'),
                'items' => [],
            ],
            self::CATEGORY_CONTENT     => [
                'id'    => self::CATEGORY_CONTENT,
                'label' => __('SEO & Content', 'attrium'),
                'items' => [],
            ],
        ];

        $counts = [
            Severity::CRITICAL => 0,
            Severity::WARNING  => 0,
            Severity::HEALTHY  => 0,
        ];

        foreach ( $items as $item ) {
            $category = (string) $item['category'];

            if ( ! isset($categories[ $category ]) ) {
                $category = self::CATEGORY_PERFORMANCE;
            }

            $categories[ $category ]['items'][] = $item;
            ++$counts[ $item['severity'] ];
        }

        $issues = 0;
        foreach ( $categories as $id => $category ) {
            $category_items  = $category['items'];
            $category_issues = 0;

            foreach ( $category_items as $item ) {
                if ( Severity::HEALTHY !== $item['severity'] ) {
                    ++$category_issues;
                }
            }

            $categories[ $id ]['issueCount'] = $category_issues;
            $issues                         += $category_issues;
        }

        return [
            'severity'   => Severity::worst(array_column($items, 'severity')),
            'issueCount' => $issues,
            'counts'     => $counts,
            'categories' => array_values($categories),
        ];
    }
}
