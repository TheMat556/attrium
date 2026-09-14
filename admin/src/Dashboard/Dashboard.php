<?php
/**
 * Dashboard REST controller.
 *
 * @package Attrium
 */

namespace Attrium\Dashboard;

defined('ABSPATH') || exit();

/**
 * Registers the read-mostly dashboard endpoints.
 *
 * Every route is gated on `manage_options`, matching the rest of Attrium. The
 * one write route only persists non-secret integration identifiers; all
 * remediation actions (updates, restores) are deliberately out of scope for v1.
 */
class Dashboard {
    const NAMESPACE = 'attrium/v1';

    public function __construct() {
        add_action('rest_api_init', [ $this, 'register_routes' ]);
    }

    public function register_routes(): void {
        register_rest_route(
            self::NAMESPACE,
            '/dashboard/summary',
            [
                [
                    'methods'             => 'GET',
                    'callback'            => [ $this, 'get_summary' ],
                    'permission_callback' => [ $this, 'can_manage' ],
                    'args'                => [
                        'refresh' => [
                            'type'    => 'boolean',
                            'default' => false,
                        ],
                    ],
                ],
            ]
        );

        register_rest_route(
            self::NAMESPACE,
            '/dashboard/traffic',
            [
                [
                    'methods'             => 'GET',
                    'callback'            => [ $this, 'get_traffic' ],
                    'permission_callback' => [ $this, 'can_manage' ],
                    'args'                => [
                        'range'   => [
                            'type'    => 'integer',
                            'default' => 7,
                        ],
                        'refresh' => [
                            'type'    => 'boolean',
                            'default' => false,
                        ],
                    ],
                ],
            ]
        );

        register_rest_route(
            self::NAMESPACE,
            '/dashboard/uptime',
            [
                [
                    'methods'             => 'GET',
                    'callback'            => [ $this, 'get_uptime' ],
                    'permission_callback' => [ $this, 'can_manage' ],
                    'args'                => [
                        'refresh' => [
                            'type'    => 'boolean',
                            'default' => false,
                        ],
                    ],
                ],
            ]
        );

        register_rest_route(
            self::NAMESPACE,
            '/dashboard/integrations',
            [
                [
                    'methods'             => 'GET',
                    'callback'            => [ $this, 'get_integrations' ],
                    'permission_callback' => [ $this, 'can_manage' ],
                ],
                [
                    'methods'             => 'POST',
                    'callback'            => [ $this, 'save_integrations' ],
                    'permission_callback' => [ $this, 'can_manage' ],
                ],
            ]
        );

        register_rest_route(
            self::NAMESPACE,
            '/dashboard/integrations/test',
            [
                [
                    'methods'             => 'POST',
                    'callback'            => [ $this, 'test_integrations' ],
                    'permission_callback' => [ $this, 'can_manage' ],
                    'args'                => [
                        'provider' => [
                            'type' => 'string',
                            'enum' => [ 'ga4', 'uptimerobot', 'backup' ],
                        ],
                    ],
                ],
            ]
        );
    }

    public function can_manage(): bool {
        return current_user_can('manage_options');
    }

    public function get_summary( \WP_REST_Request $request ): \WP_REST_Response {
        $refresh = (bool) $request->get_param('refresh');

        return new \WP_REST_Response(Data::summary($refresh), 200);
    }

    public function get_traffic( \WP_REST_Request $request ): \WP_REST_Response {
        $range   = (int) $request->get_param('range');
        $refresh = (bool) $request->get_param('refresh');

        return new \WP_REST_Response(GA4::get_traffic($range, $refresh), 200);
    }

    public function get_uptime( \WP_REST_Request $request ): \WP_REST_Response {
        $refresh = (bool) $request->get_param('refresh');

        return new \WP_REST_Response(UptimeRobot::get($refresh), 200);
    }

    public function get_integrations(): \WP_REST_Response {
        return new \WP_REST_Response(Integrations::get_config(), 200);
    }

    public function save_integrations( \WP_REST_Request $request ): \WP_REST_Response {
        $params = $request->get_json_params();

        if ( ! is_array($params) ) {
            $params = [];
        }

        return new \WP_REST_Response(Integrations::save($params), 200);
    }

    public function test_integrations( \WP_REST_Request $request ): \WP_REST_Response {
        $provider = (string) $request->get_param('provider');
        $results  = [];

        if ( '' === $provider || 'ga4' === $provider ) {
            $results['ga4'] = GA4::test_connection();
        }

        if ( '' === $provider || 'uptimerobot' === $provider ) {
            $results['uptimerobot'] = UptimeRobot::test_connection();
        }

        if ( '' === $provider || 'backup' === $provider ) {
            $backup            = Backup::get();
            $results['backup'] = [
                'ok'      => 'unavailable' !== $backup['state'] && 'no_backup' !== $backup['state'],
                'message' => 'ok' === $backup['state']
                    ? sprintf(
                        /* translators: %s: human-readable time since the last backup. */
                        __('Last backup %s.', 'attrium'),
                        $backup['human']
                    )
                    : __('UpdraftPlus is not active or has no successful backup yet.', 'attrium'),
            ];
        }

        return new \WP_REST_Response($results, 200);
    }
}
