<?php
/**
 * Integration configuration for the client health dashboard.
 *
 * Non-secret identifiers (GA4 property id, UptimeRobot monitor id, backup
 * overdue threshold) live in options and are editable from Attrium →
 * Appearance. Secrets (the GA4 service-account key and the UptimeRobot API
 * key) are read server-side from wp-config constants and are never stored in
 * the database, returned by REST, or shipped to the browser.
 *
 * @package Attrium
 */

namespace Attrium\Dashboard;

defined('ABSPATH') || exit();

/**
 * Reads and writes the dashboard integration settings.
 */
class Integrations {
    const GA4_PROPERTY_OPTION        = 'attrium_ga4_property_id';
    const UPTIMEROBOT_MONITOR_OPTION = 'attrium_uptimerobot_monitor_id';
    const BACKUP_OVERDUE_OPTION      = 'attrium_backup_overdue_days';

    const GA4_CREDENTIALS_PATH_CONST = 'ATTRIUM_GA4_CREDENTIALS_PATH';
    const GA4_CREDENTIALS_JSON_CONST = 'ATTRIUM_GA4_CREDENTIALS_JSON';
    const UPTIMEROBOT_KEY_CONST      = 'ATTRIUM_UPTIMEROBOT_API_KEY';

    const DEFAULT_BACKUP_OVERDUE_DAYS = 7;

    public static function ga4_property_id(): string {
        return trim( (string) get_option(self::GA4_PROPERTY_OPTION, ''));
    }

    public static function uptimerobot_monitor_id(): string {
        return trim( (string) get_option(self::UPTIMEROBOT_MONITOR_OPTION, ''));
    }

    public static function backup_overdue_days(): int {
        $days = (int) get_option(self::BACKUP_OVERDUE_OPTION, self::DEFAULT_BACKUP_OVERDUE_DAYS);

        /**
         * Filter the number of days after which a backup is considered overdue.
         *
         * @param int $days Overdue threshold in days.
         */
        $days = (int) apply_filters('attrium_dashboard_backup_overdue_days', $days);

        return $days > 0 ? $days : self::DEFAULT_BACKUP_OVERDUE_DAYS;
    }

    /**
     * The GA4 service-account credentials as a decoded array, or null.
     *
     * Prefers the inline JSON constant, then falls back to a file path. The
     * file is read with the local filesystem (it is a path the site owner
     * controls), not wp_remote_get().
     *
     * @return array<string, mixed>|null
     */
    public static function ga4_credentials(): ?array {
        if ( defined(self::GA4_CREDENTIALS_JSON_CONST) ) {
            $decoded = json_decode( (string) constant(self::GA4_CREDENTIALS_JSON_CONST), true);

            if ( is_array($decoded) ) {
                return $decoded;
            }
        }

        if ( ! defined(self::GA4_CREDENTIALS_PATH_CONST) ) {
            return null;
        }

        $path = (string) constant(self::GA4_CREDENTIALS_PATH_CONST);

        if ( '' === $path || ! is_readable($path) ) {
            return null;
        }

        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local credentials file; wp_remote_get() is for remote URLs.
        $contents = file_get_contents($path);
        if ( false === $contents ) {
            return null;
        }

        $decoded = json_decode($contents, true);

        return is_array($decoded) ? $decoded : null;
    }

    public static function ga4_credentials_source(): string {
        if ( defined(self::GA4_CREDENTIALS_JSON_CONST) && '' !== (string) constant(self::GA4_CREDENTIALS_JSON_CONST) ) {
            return 'json';
        }

        if ( defined(self::GA4_CREDENTIALS_PATH_CONST) && '' !== (string) constant(self::GA4_CREDENTIALS_PATH_CONST) ) {
            return 'path';
        }

        return 'none';
    }

    public static function uptimerobot_api_key(): string {
        if ( ! defined(self::UPTIMEROBOT_KEY_CONST) ) {
            return '';
        }

        return trim( (string) constant(self::UPTIMEROBOT_KEY_CONST));
    }

    public static function ga4_configured(): bool {
        return '' !== self::ga4_property_id() && null !== self::ga4_credentials();
    }

    public static function uptimerobot_configured(): bool {
        return '' !== self::uptimerobot_monitor_id() && '' !== self::uptimerobot_api_key();
    }

    /**
     * The public (secret-free) integration state for the dashboard and form.
     *
     * @return array<string, array<string, mixed>>
     */
    public static function get_config(): array {
        $credentials = self::ga4_credentials();
        $property    = self::ga4_property_id();

        return [
            'ga4'         => [
                'propertyId'            => $property,
                'credentialsSource'     => self::ga4_credentials_source(),
                'credentialsConfigured' => null !== $credentials,
                'credentialsEmail'      => is_array($credentials) && isset($credentials['client_email']) ? (string) $credentials['client_email'] : '',
                'configured'            => '' !== $property && null !== $credentials,
            ],
            'uptimerobot' => [
                'monitorId'        => self::uptimerobot_monitor_id(),
                'apiKeyConfigured' => '' !== self::uptimerobot_api_key(),
                'configured'       => self::uptimerobot_configured(),
            ],
            'backup'      => [
                'overdueDays' => self::backup_overdue_days(),
                'provider'    => 'updraftplus',
                'installed'   => Backup::is_available(),
            ],
            'constants'   => [
                'ga4CredentialsPath' => self::GA4_CREDENTIALS_PATH_CONST,
                'ga4CredentialsJson' => self::GA4_CREDENTIALS_JSON_CONST,
                'uptimerobotApiKey'  => self::UPTIMEROBOT_KEY_CONST,
            ],
        ];
    }

    /**
     * Persist the non-secret identifiers.
     *
     * @param array<string, mixed> $params Raw request params.
     * @return array<string, array<string, mixed>> The refreshed public config.
     */
    public static function save( array $params ): array {
        if ( array_key_exists('ga4PropertyId', $params) ) {
            update_option(self::GA4_PROPERTY_OPTION, sanitize_text_field( (string) $params['ga4PropertyId']));
        }

        if ( array_key_exists('uptimerobotMonitorId', $params) ) {
            update_option(self::UPTIMEROBOT_MONITOR_OPTION, sanitize_text_field( (string) $params['uptimerobotMonitorId']));
        }

        if ( array_key_exists('backupOverdueDays', $params) ) {
            $days = absint($params['backupOverdueDays']);
            update_option(self::BACKUP_OVERDUE_OPTION, $days > 0 ? $days : self::DEFAULT_BACKUP_OVERDUE_DAYS);
        }

        return self::get_config();
    }
}
