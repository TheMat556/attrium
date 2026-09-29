<?php
/**
 * Shared severity model for the client health dashboard.
 *
 * @package Attrium
 */

namespace Attrium\Dashboard;

defined('ABSPATH') || exit();

/**
 * One vocabulary for the hero verdict, Updates and Site Health.
 *
 * Every producer returns one of the three constants below; the aggregator
 * reduces them with worst(). Keeping the ranking in one place is what stops
 * the hero from ever contradicting the sections beneath it.
 */
final class Severity {
    const CRITICAL = 'critical';
    const WARNING  = 'warning';
    const HEALTHY  = 'healthy';

    /**
     * Higher sorts worse. Only the three known values are ranked.
     */
    private const RANK = [
        self::HEALTHY  => 0,
        self::WARNING  => 1,
        self::CRITICAL => 2,
    ];

    /**
     * The worst severity in a list, defaulting to healthy for an empty list.
     *
     * @param array<int|string, mixed> $severities Candidate severity strings.
     */
    public static function worst( array $severities ): string {
        $worst = self::HEALTHY;

        foreach ( $severities as $severity ) {
            if ( ! is_string($severity) || ! isset(self::RANK[ $severity ]) ) {
                continue;
            }

            if ( self::RANK[ $severity ] > self::RANK[ $worst ] ) {
                $worst = $severity;
            }
        }

        return $worst;
    }

    /**
     * Map a WordPress Site Health status ('good'|'recommended'|'critical').
     */
    public static function from_status( string $status ): string {
        if ( 'critical' === $status ) {
            return self::CRITICAL;
        }

        if ( 'recommended' === $status ) {
            return self::WARNING;
        }

        return self::HEALTHY;
    }
}
