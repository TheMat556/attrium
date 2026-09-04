<?php

namespace Attrium\Modules;

use Attrium\Settings\Settings;

defined('ABSPATH') || exit();

class ModuleRegistry {
    private array $modules;

    public function __construct() {
        // Excluded URLs never receive the theme: bail before any hook registration.
        if ( Settings::is_ignored_url() ) {
            return;
        }

        $defaults = [
            'buttons'      => true,
            'tables'       => true,
            'tabs'         => true,
            'forms'        => true,
            'checkbox'     => true,
            'notices'      => true,
            'notification' => true,
            'screen-meta'  => true,
            'postbox'      => false,
            'menu'         => false,
            'screens'      => true,
        ];

        $this->modules = apply_filters('attrium_enabled_modules', $defaults);

        add_action('admin_enqueue_scripts', [ $this, 'enqueue_styles' ]);
        add_filter('admin_body_class', [ $this, 'body_classes' ]);
    }

    public function get_enabled_modules(): array {
        return array_keys(array_filter($this->modules));
    }

    /**
     * The sanitized attrium-mod-* class names for every enabled module.
     *
     * Sanitization is load-bearing here, not defensive: module names come from
     * the attrium_enabled_modules filter, so third-party code can inject
     * arbitrary keys. On the Customizer these classes are applied with a single
     * classList.add(...$classes) spread (see CustomizerSupport::body_classes()),
     * and classList.add throws InvalidCharacterError on any token containing
     * whitespace — because it is one spread call it is all-or-nothing, so one
     * malformed module name would silently drop EVERY module class and disable
     * the whole reskin. The returned array is sequentially indexed so
     * wp_json_encode() emits a JSON array rather than an object.
     */
    public function get_module_classes(): array {
        $classes = [];

        foreach ( $this->get_enabled_modules() as $module ) {
            $name = sanitize_html_class($module);

            if ( $name === '' ) {
                continue;
            }

            $classes[] = 'attrium-mod-' . $name;
        }

        return $classes;
    }

    public function body_classes( string $classes ): string {
        foreach ( $this->get_module_classes() as $class ) {
            $classes .= ' ' . $class;
        }

        return $classes;
    }

    /**
     * Enqueue the theme CSS as per-topic chunks.
     *
     * scripts/build-css.mjs compiles each scss/entries/*.scss topic into its
     * own minified app/dist/admin-theme-{topic}.css file. The base chunk
     * carries the --attrium-* tokens every other chunk references; then one
     * chunk per enabled module (buttons, tables, … plus screens), so the
     * attrium_enabled_modules filter actually drops CSS payload — disabled
     * modules aren't loaded at all. Missing chunks (build not run / module
     * without styles) are skipped individually.
     */
    public function enqueue_styles(): void {
        $css_dir = ATTRIUM_PATH . 'app/dist';
        $css_url = ATTRIUM_URL . 'app/dist';

        $chunks = array_merge([ 'base' ], $this->get_enabled_modules());

        foreach ( $chunks as $chunk ) {
            $file = "admin-theme-{$chunk}.css";

            if ( ! file_exists($css_dir . '/' . $file) ) {
                continue;
            }

            wp_enqueue_style(
                "attrium-admin-theme-{$chunk}",
                $css_url . '/' . $file,
                [ 'common', 'wp-admin' ],
                (string) filemtime($css_dir . '/' . $file)
            );
        }
    }
}
