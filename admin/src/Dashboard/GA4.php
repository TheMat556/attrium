<?php
/**
 * Google Analytics 4 Data API client for the dashboard.
 *
 * @package Attrium
 */

namespace Attrium\Dashboard;

defined('ABSPATH') || exit();

/**
 * Server-side GA4 reporting.
 *
 * The service-account key never leaves the server: PHP signs the OAuth JWT,
 * exchanges it for an access token, and calls runReport. Only aggregated
 * numbers reach the browser. Every report is cached independently so opening
 * wp-admin does not hammer the API.
 */
class GA4 {
    const TOKEN_TRANSIENT = 'attrium_dashboard_ga4_token';
    const CACHE_PREFIX    = 'attrium_dashboard_ga4_';
    const CACHE_TTL       = 15 * MINUTE_IN_SECONDS;
    const TOKEN_ENDPOINT  = 'https://oauth2.googleapis.com/token';
    const API_BASE        = 'https://analyticsdata.googleapis.com/v1beta/properties/';

    const STATE_OK             = 'ok';
    const STATE_NOT_CONFIGURED = 'not_configured';
    const STATE_ERROR          = 'error';

    /**
     * @param int  $range   Number of days (7 or 30).
     * @param bool $refresh Bypass the cache.
     * @return array<string, mixed>
     */
    public static function get_traffic( int $range, bool $refresh = false ): array {
        $range = self::normalize_range($range);

        if ( ! Integrations::ga4_configured() ) {
            return self::unavailable(
                $range,
                self::STATE_NOT_CONFIGURED,
                __('Connect Google Analytics to see traffic.', 'attrium')
            );
        }

        $cache_key = self::CACHE_PREFIX . $range;

        if ( ! $refresh ) {
            $cached = get_transient($cache_key);

            if ( is_array($cached) ) {
                return $cached;
            }
        }

        $property = self::property_id();
        $totals   = self::run_report($property, self::totals_body($range));

        if ( is_wp_error($totals) ) {
            return self::unavailable($range, self::STATE_ERROR, $totals->get_error_message());
        }

        $daily   = self::run_report($property, self::daily_body($range));
        $top     = self::run_report($property, self::top_content_body($range));
        $devices = self::run_report($property, self::devices_body($range));

        $current  = self::metric_pair($totals, 0);
        $previous = self::metric_pair($totals, 1);

        $result = [
            'state'        => self::STATE_OK,
            'severity'     => Severity::HEALTHY,
            'range'        => $range,
            'visitors'     => (int) $current['users'],
            'views'        => (int) $current['views'],
            'prevVisitors' => (int) $previous['users'],
            'prevViews'    => (int) $previous['views'],
            'deltaPct'     => self::delta($current['users'], $previous['users']),
            'points'       => is_wp_error($daily) ? [] : self::parse_daily($daily),
            'topContent'   => is_wp_error($top) ? [] : self::parse_top_content($top),
            'devices'      => is_wp_error($devices) ? [] : self::parse_devices($devices),
            'fetchedAt'    => time(),
            'message'      => '',
        ];

        set_transient($cache_key, $result, self::CACHE_TTL);

        return $result;
    }

    /**
     * Cheap credential/permission probe used by the settings screen.
     *
     * @return array{ok: bool, message: string}
     */
    public static function test_connection(): array {
        if ( ! Integrations::ga4_configured() ) {
            return [
                'ok'      => false,
                'message' => __('Add the property ID and wp-config credentials first.', 'attrium'),
            ];
        }

        $result = self::run_report(self::property_id(), self::totals_body(7));

        if ( is_wp_error($result) ) {
            return [
                'ok'      => false,
                'message' => $result->get_error_message(),
            ];
        }

        return [
            'ok'      => true,
            'message' => __('Google Analytics connected.', 'attrium'),
        ];
    }

    private static function normalize_range( int $range ): int {
        return 30 === $range ? 30 : 7;
    }

    private static function property_id(): string {
        return (string) preg_replace('/[^0-9]/', '', Integrations::ga4_property_id());
    }

    /**
     * @return array<string, mixed>
     */
    private static function unavailable( int $range, string $state, string $message ): array {
        return [
            'state'        => $state,
            'severity'     => Severity::WARNING,
            'range'        => $range,
            'visitors'     => 0,
            'views'        => 0,
            'prevVisitors' => 0,
            'prevViews'    => 0,
            'deltaPct'     => null,
            'points'       => [],
            'topContent'   => [],
            'devices'      => [],
            'fetchedAt'    => null,
            'message'      => $message,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private static function totals_body( int $range ): array {
        return [
            'dateRanges' => [
                [
                    'startDate' => $range . 'daysAgo',
                    'endDate'   => 'today',
                ],
                [
                    'startDate' => ( $range * 2 ) . 'daysAgo',
                    'endDate'   => ( $range + 1 ) . 'daysAgo',
                ],
            ],
            'metrics'    => [
                [ 'name' => 'activeUsers' ],
                [ 'name' => 'screenPageViews' ],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private static function daily_body( int $range ): array {
        return [
            'dateRanges' => [
                [
                    'startDate' => $range . 'daysAgo',
                    'endDate'   => 'today',
                ],
            ],
            'dimensions' => [
                [ 'name' => 'date' ],
            ],
            'metrics'    => [
                [ 'name' => 'activeUsers' ],
                [ 'name' => 'screenPageViews' ],
            ],
            'orderBys'   => [
                [
                    'dimension' => [
                        'dimensionName' => 'date',
                    ],
                ],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private static function top_content_body( int $range ): array {
        return [
            'dateRanges' => [
                [
                    'startDate' => $range . 'daysAgo',
                    'endDate'   => 'today',
                ],
            ],
            'dimensions' => [
                [ 'name' => 'pageTitle' ],
            ],
            'metrics'    => [
                [ 'name' => 'screenPageViews' ],
            ],
            'orderBys'   => [
                [
                    'metric' => [
                        'metricName' => 'screenPageViews',
                    ],
                    'desc'   => true,
                ],
            ],
            'limit'      => 5,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private static function devices_body( int $range ): array {
        return [
            'dateRanges' => [
                [
                    'startDate' => $range . 'daysAgo',
                    'endDate'   => 'today',
                ],
            ],
            'dimensions' => [
                [ 'name' => 'deviceCategory' ],
            ],
            'metrics'    => [
                [ 'name' => 'activeUsers' ],
            ],
            'orderBys'   => [
                [
                    'metric' => [
                        'metricName' => 'activeUsers',
                    ],
                    'desc'   => true,
                ],
            ],
        ];
    }

    /**
     * Call runReport, returning a WP_Error on any failure.
     *
     * @param array<string, mixed> $body Report definition.
     * @return array<string, mixed>|\WP_Error
     */
    private static function run_report( string $property, array $body ) {
        if ( '' === $property ) {
            return new \WP_Error('attrium_ga4_no_property', __('Google Analytics property ID is missing.', 'attrium'));
        }

        $token = self::access_token();

        if ( is_wp_error($token) ) {
            return $token;
        }

        $response = wp_remote_post(
            self::API_BASE . $property . ':runReport',
            [
                'timeout' => 15,
                'headers' => [
                    'Authorization' => 'Bearer ' . $token,
                    'Content-Type'  => 'application/json',
                ],
                'body'    => wp_json_encode($body),
            ]
        );

        if ( is_wp_error($response) ) {
            return $response;
        }

        $code = (int) wp_remote_retrieve_response_code($response);
        $data = json_decode( (string) wp_remote_retrieve_body($response), true);

        if ( $code < 200 || $code >= 300 || ! is_array($data) ) {
            $message = is_array($data) && isset($data['error']['message'])
                ? (string) $data['error']['message']
                : sprintf(
                    /* translators: %d: HTTP status code. */
                    __('Google Analytics request failed (HTTP %d).', 'attrium'),
                    $code
                );

            return new \WP_Error('attrium_ga4_request', $message);
        }

        return $data;
    }

    /**
     * Mint (or reuse) an OAuth access token from the service account.
     *
     * @return string|\WP_Error
     */
    private static function access_token() {
        $cached = get_transient(self::TOKEN_TRANSIENT);

        if ( is_string($cached) && '' !== $cached ) {
            return $cached;
        }

        $credentials = Integrations::ga4_credentials();

        if ( ! is_array($credentials) || empty($credentials['client_email']) || empty($credentials['private_key']) ) {
            return new \WP_Error('attrium_ga4_credentials', __('Google Analytics service-account credentials are invalid.', 'attrium'));
        }

        $now = time();
        $jwt = self::jwt(
            (string) $credentials['client_email'],
            (string) $credentials['private_key'],
            $now
        );

        if ( is_wp_error($jwt) ) {
            return $jwt;
        }

        $response = wp_remote_post(
            self::TOKEN_ENDPOINT,
            [
                'timeout' => 15,
                'body'    => [
                    'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    'assertion'  => $jwt,
                ],
            ]
        );

        if ( is_wp_error($response) ) {
            return $response;
        }

        $data = json_decode( (string) wp_remote_retrieve_body($response), true);

        if ( ! is_array($data) || empty($data['access_token']) ) {
            $message = is_array($data) && isset($data['error_description'])
                ? (string) $data['error_description']
                : __('Could not authenticate with Google.', 'attrium');

            return new \WP_Error('attrium_ga4_token', $message);
        }

        $expires = isset($data['expires_in']) ? (int) $data['expires_in'] : 3600;
        set_transient(self::TOKEN_TRANSIENT, (string) $data['access_token'], max(60, $expires - 60));

        return (string) $data['access_token'];
    }

    /**
     * @param string $email      Service-account email.
     * @param string $private_key PEM private key.
     * @return string|\WP_Error
     */
    private static function jwt( string $email, string $private_key, int $now ) {
        $header = [
            'alg' => 'RS256',
            'typ' => 'JWT',
        ];

        $claims = [
            'iss'   => $email,
            'scope' => 'https://www.googleapis.com/auth/analytics.readonly',
            'aud'   => self::TOKEN_ENDPOINT,
            'iat'   => $now,
            'exp'   => $now + 3600,
        ];

        $segments = [
            self::base64url( (string) wp_json_encode($header)),
            self::base64url( (string) wp_json_encode($claims)),
        ];

        $signing_input = implode('.', $segments);
        $signature     = '';

        $key = openssl_pkey_get_private($private_key);

        if ( false === $key ) {
            return new \WP_Error('attrium_ga4_key', __('Could not read the Google private key.', 'attrium'));
        }

        $signed = openssl_sign($signing_input, $signature, $key, OPENSSL_ALGO_SHA256);

        if ( ! $signed ) {
            return new \WP_Error('attrium_ga4_key', __('Could not sign the Google authentication request.', 'attrium'));
        }

        $segments[] = self::base64url($signature);

        return implode('.', $segments);
    }

    private static function base64url( string $value ): string {
        // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- JWT segments are base64url by specification.
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    /**
     * Metric pair for one date range from a totals response.
     *
     * @param array<string, mixed> $data     Report response.
     * @param int                  $row_index Date-range index.
     * @return array{users: int, views: int}
     */
    private static function metric_pair( array $data, int $row_index ): array {
        $rows = isset($data['rows']) && is_array($data['rows']) ? $data['rows'] : [];

        if ( ! isset($rows[ $row_index ]['metricValues']) ) {
            return [
                'users' => 0,
                'views' => 0,
            ];
        }

        $values = $rows[ $row_index ]['metricValues'];

        return [
            'users' => isset($values[0]['value']) ? (int) $values[0]['value'] : 0,
            'views' => isset($values[1]['value']) ? (int) $values[1]['value'] : 0,
        ];
    }

    /**
     * @return array<int, array{date: string, users: int, views: int}>
     */
    private static function parse_daily( array $data ): array {
        $points = [];
        $rows   = isset($data['rows']) && is_array($data['rows']) ? $data['rows'] : [];

        foreach ( $rows as $row ) {
            $raw = isset($row['dimensionValues'][0]['value']) ? (string) $row['dimensionValues'][0]['value'] : '';

            if ( '' === $raw ) {
                continue;
            }

            $points[] = [
                'date'  => self::format_date($raw),
                'users' => isset($row['metricValues'][0]['value']) ? (int) $row['metricValues'][0]['value'] : 0,
                'views' => isset($row['metricValues'][1]['value']) ? (int) $row['metricValues'][1]['value'] : 0,
            ];
        }

        return $points;
    }

    /**
     * @return array<int, array{title: string, path: string, views: int}>
     */
    private static function parse_top_content( array $data ): array {
        $items = [];
        $rows  = isset($data['rows']) && is_array($data['rows']) ? $data['rows'] : [];

        foreach ( $rows as $row ) {
            $title = isset($row['dimensionValues'][0]['value']) ? (string) $row['dimensionValues'][0]['value'] : '';

            if ( '' === $title ) {
                $title = __('(not set)', 'attrium');
            }

            $items[] = [
                'title' => $title,
                'path'  => '',
                'views' => isset($row['metricValues'][0]['value']) ? (int) $row['metricValues'][0]['value'] : 0,
            ];
        }

        return $items;
    }

    /**
     * @return array<int, array{category: string, users: int}>
     */
    private static function parse_devices( array $data ): array {
        $items = [];
        $rows  = isset($data['rows']) && is_array($data['rows']) ? $data['rows'] : [];

        foreach ( $rows as $row ) {
            $category = isset($row['dimensionValues'][0]['value']) ? (string) $row['dimensionValues'][0]['value'] : '';

            if ( '' === $category ) {
                continue;
            }

            $items[] = [
                'category' => $category,
                'users'    => isset($row['metricValues'][0]['value']) ? (int) $row['metricValues'][0]['value'] : 0,
            ];
        }

        return $items;
    }

    private static function format_date( string $raw ): string {
        // GA4 returns YYYYMMDD.
        if ( 8 === strlen($raw) && ctype_digit($raw) ) {
            return substr($raw, 0, 4) . '-' . substr($raw, 4, 2) . '-' . substr($raw, 6, 2);
        }

        return $raw;
    }

    private static function delta( int $current, int $previous ): ?float {
        if ( $previous <= 0 ) {
            return null;
        }

        return round(( ( $current - $previous ) / $previous ) * 100, 1);
    }
}
