<?php

namespace Attrium\Modules;

defined('ABSPATH') || exit();

class ModuleRegistry {
    private array $modules;

    public function __construct() {
        $defaults = [
            'buttons' => true,
            'tables'  => true,
            'tabs'    => true,
            'forms'   => true,
            'notices' => true,
            'notification' => true,
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

    /**
     * Whether the current request is a Bricks (third-party page builder) admin
     * page. Bricks registers every one of its admin screens under
     * admin.php?page=bricks-* (bricks-getting-started, bricks-settings,
     * bricks-license, bricks-templates, …), so the `page` query var prefix is a
     * stable signal for the whole Bricks menu.
     *
     * The reskin is entirely opt-in via the `attrium-mod-*` body classes and the
     * admin-theme.css enqueue below; skipping both on Bricks pages leaves the
     * builder's own admin UI completely untouched (self-contained styling),
     * without any CSS `:not()` overrides.
     */
    private function is_excluded_screen(): bool {
        // Read-only page-routing check for style gating; no state change, so no
        // nonce verification is warranted.
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        $page = isset($_GET['page']) ? sanitize_key(wp_unslash($_GET['page'])) : '';

        return 0 === strpos($page, 'bricks');
    }

    public function body_classes(string $classes): string {
        if ( $this->is_excluded_screen() ) {
            return $classes;
        }

        foreach ($this->get_enabled_modules() as $module) {
            $classes .= " attrium-mod-{$module}";
        }

        return $classes;
    }

    public function enqueue_styles(): void {
        if ( $this->is_excluded_screen() ) {
            return;
        }

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
