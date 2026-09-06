<?php

namespace Attrium\Utility;

defined('ABSPATH') || exit();

class Scripts {
    private static function get_manifest(): ?array {
        // Immutable within a request, but resolved by load_styles(),
        // load_base_scripts() and build_attrium() — parse it once. A cached
        // null (missing or invalid manifest) is correct for every caller.
        static $cache       = null;
        static $is_resolved = false;

        if ( $is_resolved ) {
            return $cache;
        }

        $is_resolved   = true;
        $manifest_path = ATTRIUM_PATH . 'app/dist/.vite/manifest.json';

        if ( ! file_exists($manifest_path) ) {
            return null;
        }

        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local file read; wp_remote_get() is for remote URLs.
        $content = file_get_contents($manifest_path);
        if ( $content === false ) {
            return null;
        }

        $manifest = json_decode($content, true);
        $cache    = is_array($manifest) ? $manifest : null;

        return $cache;
    }

    /**
     * The manifest entry whose 'src' matches $src, or null.
     *
     * Single lookup shared by get_build_file() and get_build_css(); a
     * malformed build entry degrades to null in the callers, never to a
     * PHP warning.
     */
    private static function find_entry( string $src ): ?array {
        $manifest = self::get_manifest();

        if ( ! $manifest ) {
            return null;
        }

        foreach ( $manifest as $entry ) {
            if ( isset($entry['src']) && $entry['src'] === $src ) {
                return $entry;
            }
        }

        return null;
    }

    public static function get_build_file( string $src ): ?string {
        $entry = self::find_entry($src);

        if ( ! isset($entry['file']) ) {
            return null;
        }

        return $entry['file'];
    }

    public static function get_build_css( string $src ): ?string {
        $entry = self::find_entry($src);

        if ( isset($entry['css']) && is_array($entry['css']) && ! empty($entry['css']) ) {
            return $entry['css'][0];
        }

        // cssCodeSplit: false merges every entry's CSS into the root
        // style.css asset, and the src/main.ts manifest entry has no css
        // key — this fallback is the normal path, not the exception.
        $manifest = self::get_manifest();

        if ( isset($manifest['style.css']['file']) ) {
            return $manifest['style.css']['file'];
        }

        return null;
    }
    /**
     * Enqueue the shared build stylesheet under the `attrium` handle.
     *
     * The handle is deliberately shared by both callers — the admin shell
     * (Attrium::load_styles()) and the Customizer
     * (CustomizerSupport::enqueue_styles()) — so the two can never drift.
     * vite.config.ts sets cssCodeSplit: false, so every entry's CSS is merged
     * into the single style.css asset, which get_build_css() resolves via its
     * style.css manifest fallback (the src/main.ts manifest entry has no css
     * key). Today that file contains only the Inter Variable @font-face rules
     * from src/fonts.css — src/style.css and scss/_tokens.scss are imported
     * with ?inline into the shadow root, so no Tailwind preflight is in it.
     * Caution: adding a non-?inline CSS import to any entry will ship that CSS
     * to every admin page AND to the Customizer through this method.
     */
    public static function enqueue_build_style( string $src ): void {
        $css_file = self::get_build_css($src);

        if ( ! $css_file ) {
            return;
        }

        wp_enqueue_style('attrium', ATTRIUM_URL . 'app/dist/' . $css_file, [], ATTRIUM_VERSION);
    }
}
