<?php
/**
 * Backup freshness adapter (UpdraftPlus-first) for the dashboard.
 *
 * @package Attrium
 */

namespace Attrium\Dashboard;

defined('ABSPATH') || exit();

/**
 * Reads the last successful backup timestamp from an existing backup plugin.
 *
 * v1 targets UpdraftPlus, which stores its history in options. Detection is
 * read-only — it never triggers a backup. The result shape is provider-neutral
 * and exposes the `attrium_dashboard_last_backup` filter so a second provider
 * can be added without touching the dashboard.
 */
class Backup {
    const UPDRAFTPLUS_PLUGIN = 'updraftplus/updraftplus.php';

    /**
     * @return array<string, mixed>
     */
    public static function get(): array {
        $overdue_days = Integrations::backup_overdue_days();
        $available    = self::is_available();
        $timestamp    = $available ? self::last_successful_timestamp() : null;

        /**
         * Filter the resolved last-backup timestamp.
         *
         * @param int|null $timestamp Unix timestamp of the last successful backup, or null.
         * @param bool     $available Whether a supported backup plugin is active.
         */
        $timestamp = apply_filters('attrium_dashboard_last_backup', $timestamp, $available);

        $base = [
            'provider'    => 'UpdraftPlus',
            'available'   => $available,
            'overdueDays' => $overdue_days,
            'actionUrl'   => admin_url('options-general.php?page=updraftplus'),
            'timestamp'   => is_int($timestamp) ? $timestamp : null,
            'human'       => is_int($timestamp) ? self::relative($timestamp) : '',
        ];

        if ( ! $available ) {
            return array_merge(
                $base,
                [
                    'state'    => 'unavailable',
                    'severity' => Severity::WARNING,
                ]
            );
        }

        if ( ! is_int($timestamp) || $timestamp <= 0 ) {
            return array_merge(
                $base,
                [
                    'state'    => 'no_backup',
                    'severity' => Severity::WARNING,
                ]
            );
        }

        $age = time() - $timestamp;

        return array_merge(
            $base,
            [
                'state'    => $age > ( $overdue_days * DAY_IN_SECONDS ) ? 'overdue' : 'ok',
                'severity' => $age > ( $overdue_days * DAY_IN_SECONDS ) ? Severity::WARNING : Severity::HEALTHY,
            ]
        );
    }

    public static function is_available(): bool {
        if ( ! function_exists('is_plugin_active') ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        if ( function_exists('is_plugin_active') && is_plugin_active(self::UPDRAFTPLUS_PLUGIN) ) {
            return true;
        }

        return function_exists('updraftplus') || class_exists('UpdraftPlus');
    }

    /**
     * The most recent successful backup across UpdraftPlus's option structures.
     */
    private static function last_successful_timestamp(): ?int {
        $candidates = [];

        $last = get_option('updraft_last_backup');

        if ( is_array($last) && isset($last['backup_time'], $last['backup_status']) ) {
            // UpdraftPlus records 1 for a clean, successful run.
            if ( 1 === (int) $last['backup_status'] && (int) $last['backup_time'] > 0 ) {
                $candidates[] = (int) $last['backup_time'];
            }
        }

        foreach ( [ 'updraft_backup_history', 'updraftplus_backup_history' ] as $option ) {
            $history = get_option($option);

            if ( ! is_array($history) ) {
                continue;
            }

            foreach ( $history as $key => $backup ) {
                if ( ! is_numeric($key) || (int) $key <= 0 ) {
                    continue;
                }

                if ( ! is_array($backup) || [] === $backup ) {
                    continue;
                }

                $candidates[] = (int) $key;
            }
        }

        if ( [] === $candidates ) {
            return null;
        }

        return max($candidates);
    }

    private static function relative( int $timestamp ): string {
        if ( function_exists('human_time_diff') ) {
            /* translators: %s: human-readable time difference, e.g. "2 days". */
            return sprintf(__('%s ago', 'attrium'), human_time_diff($timestamp, time()));
        }

        return gmdate('Y-m-d H:i:s', $timestamp);
    }
}
