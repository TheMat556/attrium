<?php

namespace Attrium\Modules;

defined('ABSPATH') || exit();

class ModuleRegistry {
    private array $modules;

    public function __construct() {
        $defaults = [
            'buttons' => true,
            'tables'  => false,
            'forms'   => true,
            'notices' => false,
            'postbox' => false,
            'menu'    => false,
            'screens' => true,
        ];

        $this->modules = apply_filters('attrium_enabled_modules', $defaults);

        add_action('admin_enqueue_scripts', [ $this, 'enqueue_styles' ]);
        add_filter('admin_body_class', [ $this, 'body_classes' ]);
    }

    public function get_enabled_modules(): array {
        return array_keys(array_filter($this->modules));
    }

    public function body_classes(string $classes): string {
        foreach ($this->get_enabled_modules() as $module) {
            $classes .= " attrium-mod-{$module}";
        }

        return $classes;
    }

    public function enqueue_styles(): void {
        $css_path = ATTRIUM_PATH . 'app/dist/admin-theme.css';
        $css_url  = ATTRIUM_URL . 'app/dist/admin-theme.css';

        if ( ! file_exists($css_path) ) {
            return;
        }

        wp_enqueue_style(
            'attrium-admin-theme',
            $css_url,
            [ 'common', 'wp-admin' ],
            (string) filemtime($css_path)
        );
    }
}
