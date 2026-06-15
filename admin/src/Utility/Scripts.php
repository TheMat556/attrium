<?php

namespace Attrium\Utility;

defined("ABSPATH") || exit();

class Scripts {
    private static function get_manifest() {
        $manifest_path = ATTRIUM_PATH . 'app/dist/.vite/manifest.json';

        if (!file_exists($manifest_path)) {
            return null;
        }

        $content = file_get_contents($manifest_path);
        if ($content === false) {
            return null;
        }

        $manifest = json_decode($content, true);
        return is_array($manifest) ? $manifest : null;
    }

    public static function get_build_file($src) {
        $manifest = self::get_manifest();
        if (!$manifest) {
            return null;
        }

        foreach ($manifest as $entry) {
            if (isset($entry['src']) && $entry['src'] === $src) {
                return $entry['file'];
            }
        }

        return null;
    }

    public static function get_build_css($src) {
        $manifest = self::get_manifest();

        if (!$manifest) {
            return null;
        }

        foreach ($manifest as $entry) {
            if (isset($entry['src']) && $entry['src'] === $src) {
                if (isset($entry['css']) && is_array($entry['css']) && !empty($entry['css'])) {
                    return $entry['css'][0];
                }
            }
        }

        if (isset($manifest['style.css']['file'])) {
            return $manifest['style.css']['file'];
        }

        return null;
    }
}
