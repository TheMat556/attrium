<?php

namespace Attrium\Utility;

defined('ABSPATH') || exit();

class Scripts {
    private static function get_manifest() {
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
        return is_array($manifest) ? $manifest : null;
    }

    public static function get_build_file( $src ) {
        $manifest = self::get_manifest();
        if ( ! $manifest ) {
            return null;
        }

        foreach ( $manifest as $entry ) {
            if ( isset($entry['src']) && $entry['src'] === $src ) {
                return $entry['file'];
            }
        }

        return null;
    }

    public static function get_build_css( $src ) {
        $manifest = self::get_manifest();

        if ( ! $manifest ) {
            return null;
        }

        foreach ( $manifest as $entry ) {
            if ( isset($entry['src']) && $entry['src'] === $src ) {
                if ( isset($entry['css']) && is_array($entry['css']) && ! empty($entry['css']) ) {
                    return $entry['css'][0];
                }
            }
        }

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
    public static function enqueue_build_style( $src ): void {
        $css_file = self::get_build_css($src);

        if ( ! $css_file ) {
            return;
        }

        wp_enqueue_style('attrium', ATTRIUM_URL . 'app/dist/' . $css_file, [], ATTRIUM_VERSION);
    }
}
