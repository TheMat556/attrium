<?php
/**
 * UptimeRobot client for the dashboard.
 *
 * @package Attrium
 */

namespace Attrium\Dashboard;

defined('ABSPATH') || exit();

/**
 * Reads monitor state and 30-day uptime from UptimeRobot.
 *
 * The API key is a wp-config constant and never reaches the browser. A
 * successful response is kept as a long-lived "last good" snapshot so a
 * transient provider outage shows the previous reading, clearly marked stale,
 * instead of blanking the card.
 */
class UptimeRobot {
    const CACHE_TRANSIENT     = 'attrium_dashboard_uptimerobot';
    const LAST_GOOD_TRANSIENT = 'attrium_dashboard_uptimerobot_last';
    const CACHE_TTL           = 10 * MINUTE_IN_SECONDS;
    const LAST_GOOD_TTL       = 7 * DAY_IN_SECONDS;
    const ENDPOINT            = 'https://api.uptimerobot.com/v2/getMonitors';

    const STATE_OK             = 'ok';
    const STATE_STALE          = 'stale';
    const STATE_NOT_CONFIGURED = 'not_configured';
    const STATE_ERROR          = 'error';

    /**
     * @param bool $refresh Bypass the short cache.
     * @return array<string, mixed>
     */
    public static function get( bool $refresh = false ): array {
        if ( ! Integrations::uptimerobot_configured() ) {
            return self::base(
                [
                    'state'    => self::STATE_NOT_CONFIGURED,
                    'severity' => Severity::WARNING,
                    'message'  => __('Connect UptimeRobot to see uptime.', 'attrium'),
                ]
            );
        }

        if ( ! $refresh ) {
            $cached = get_transient(self::CACHE_TRANSIENT);

            if ( is_array($cached) ) {
                return $cached;
            }
        }

        $result = self::request();

        if ( is_wp_error($result) ) {
            $last_good = get_transient(self::LAST_GOOD_TRANSIENT);

            if ( is_array($last_good) ) {
                return array_merge(
                    $last_good,
                    [
                        'state'    => self::STATE_STALE,
                        'severity' => Severity::WARNING,
                        'message'  => $result->get_error_message(),
                    ]
                );
            }

            return self::base(
                [
                    'state'    => self::STATE_ERROR,
                    'severity' => Severity::WARNING,
                    'message'  => $result->get_error_message(),
                ]
            );
        }

        set_transient(self::CACHE_TRANSIENT, $result, self::CACHE_TTL);
        set_transient(self::LAST_GOOD_TRANSIENT, $result, self::LAST_GOOD_TTL);

        return $result;
    }

    /**
     * Cheap connectivity probe used by the settings screen.
     *
     * @return array{ok: bool, message: string}
     */
    public static function test_connection(): array {
        if ( ! Integrations::uptimerobot_configured() ) {
            return [
                'ok'      => false,
                'message' => __('Add the monitor ID and wp-config API key first.', 'attrium'),
            ];
        }

        $result = self::request();

        if ( is_wp_error($result) ) {
            return [
                'ok'      => false,
                'message' => $result->get_error_message(),
            ];
        }

        return [
            'ok'      => true,
            'message' => __('UptimeRobot connected.', 'attrium'),
        ];
    }

    /**
     * @return array<string, mixed>|\WP_Error
     */
    private static function request() {
        $response = wp_remote_post(
            self::ENDPOINT,
            [
                'timeout' => 15,
                'body'    => [
                    'api_key'              => Integrations::uptimerobot_api_key(),
                    'monitors'             => Integrations::uptimerobot_monitor_id(),
                    'custom_uptime_ratios' => '30',
                    'format'               => 'json',
                ],
            ]
        );

        if ( is_wp_error($response) ) {
            return $response;
        }

        $data = json_decode( (string) wp_remote_retrieve_body($response), true);

        if ( ! is_array($data) || ! isset($data['stat']) ) {
            return new \WP_Error('attrium_uptimerobot_response', __('UptimeRobot returned an unexpected response.', 'attrium'));
        }

        if ( 'ok' !== $data['stat'] ) {
            $message = isset($data['error']['message'])
                ? (string) $data['error']['message']
                : __('UptimeRobot rejected the request.', 'attrium');

            return new \WP_Error('attrium_uptimerobot_request', $message);
        }

        if ( empty($data['monitors'][0]) || ! is_array($data['monitors'][0]) ) {
            return new \WP_Error('attrium_uptimerobot_monitor', __('The configured UptimeRobot monitor was not found.', 'attrium'));
        }

        return self::normalize($data['monitors'][0]);
    }

    /**
     * @param array<string, mixed> $monitor Raw monitor object.
     * @return array<string, mixed>
     */
    private static function normalize( array $monitor ): array {
        $status     = isset($monitor['status']) ? (int) $monitor['status'] : 1;
        $status_map = [
            0 => [
                'text'     => __('Paused', 'attrium'),
                'severity' => Severity::WARNING,
            ],
            1 => [
                'text'     => __('Waiting for first check', 'attrium'),
                'severity' => Severity::WARNING,
            ],
            2 => [
                'text'     => __('Up', 'attrium'),
                'severity' => Severity::HEALTHY,
            ],
            8 => [
                'text'     => __('Looks down', 'attrium'),
                'severity' => Severity::CRITICAL,
            ],
            9 => [
                'text'     => __('Down', 'attrium'),
                'severity' => Severity::CRITICAL,
            ],
        ];

        $mapped = isset($status_map[ $status ]) ? $status_map[ $status ] : $status_map[1];
        $ratio  = isset($monitor['custom_uptime_ratio']) ? (float) $monitor['custom_uptime_ratio'] : null;

        return self::base(
            [
                'state'       => self::STATE_OK,
                'severity'    => $mapped['severity'],
                'monitorName' => isset($monitor['friendly_name']) ? (string) $monitor['friendly_name'] : '',
                'url'         => isset($monitor['url']) ? (string) $monitor['url'] : '',
                'status'      => $status,
                'statusText'  => $mapped['text'],
                'uptime30d'   => null === $ratio ? null : round($ratio, 2),
                'fetchedAt'   => time(),
                'message'     => '',
            ]
        );
    }

    /**
     * @param array<string, mixed> $overrides Values to merge over the defaults.
     * @return array<string, mixed>
     */
    private static function base( array $overrides ): array {
        return array_merge(
            [
                'state'       => self::STATE_ERROR,
                'severity'    => Severity::WARNING,
                'monitorName' => '',
                'url'         => '',
                'status'      => null,
                'statusText'  => '',
                'uptime30d'   => null,
                'fetchedAt'   => null,
                'message'     => '',
            ],
            $overrides
        );
    }
}
