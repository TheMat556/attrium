<?php

namespace Attrium\Modules;

use Attrium\Settings\Settings;

defined('ABSPATH') || exit();

/**
 * Customizer (customize.php) compatibility.
 *
 * The Customizer is a native full-screen overlay and is excluded from the
 * Attrium Vue shell (see Attrium::is_overlay_screen()). It does not go through
 * admin-header.php, so the module registry's admin_enqueue_scripts /
 * admin_body_class hooks never fire there. This class registers the same
 * theme on the customizer's own hooks so the reskin
 * (scss/screens/_customize-*.scss) loads and light/dark resolves.
 */
class CustomizerSupport {
    private ModuleRegistry $registry;

    public function __construct( ModuleRegistry $registry ) {
        $this->registry = $registry;

        // Excluded URLs never receive the theme: bail before any hook registration.
        if ( Settings::is_ignored_url() ) {
            return;
        }

        add_action('customize_controls_enqueue_scripts', [ $this, 'enqueue_styles' ]);
        add_action('customize_controls_print_footer_scripts', [ $this, 'body_classes' ]);
        add_action('customize_controls_head', [ $this, 'theme_script' ]);
    }

    /**
     * Enqueue the theme CSS chunks on the Customizer.
     *
     * Reuses ModuleRegistry::enqueue_styles() so the module toggles apply
     * identically on customize.php. wp_enqueue_style is idempotent by handle,
     * so sharing the enqueue with the admin hook is safe if both ever fire.
     */
    public function enqueue_styles(): void {
        $this->registry->enqueue_styles();
    }

    /**
     * Apply the Attrium theme (light/dark) to the Customizer.
     *
     * The customizer has no #attrium-host, so the shell's useColorMode never
     * runs on this page. Read the same attrium-theme storage key the shell
     * uses and toggle `attrium-dark` on <html> before first paint: _tokens.scss
     * carries the dark palette under html.attrium-dark, so the whole page
     * resolves the dark tokens from the start (no light flash). An unset key
     * or 'auto' follows prefers-color-scheme, mirroring useColorMode's
     * default in src/composables/useTheme.ts. A storage listener keeps an open
     * customizer in sync when the theme changes in another tab.
     */
    public function theme_script(): void {
        $script = <<<'JS'
        (function () {
            function apply() {
                var stored;
                try { stored = localStorage.getItem('attrium-theme'); } catch (e) {}
                var auto = !stored || stored === 'auto';
                var dark = stored === 'dark' || (auto && window.matchMedia('(prefers-color-scheme: dark)').matches);
                document.documentElement.classList.toggle('attrium-dark', dark);
            }
            apply();
            window.addEventListener('storage', function (e) {
                if (e.key === 'attrium-theme') apply();
            });
        })();
        JS;

        wp_print_inline_script_tag($script);
    }

    /**
     * Add the attrium-mod-* body classes to the Customizer.
     *
     * customize.php hardcodes its own <body> class string and never applies the
     * admin_body_class filter, so the module classes can't be injected the way
     * ModuleRegistry::body_classes() does elsewhere. The page has no <body>
     * element until the customize_controls_print_footer_scripts action (fires
     * right before </body>), so the classes are added from a tiny inline script
     * at that point — same class names, so the module toggles keep working. The
     * initial paint is the customizer's "Loading…" screen, so the one-frame
     * unstyled flash is invisible.
     */
    public function body_classes(): void {
        $classes = array_map(
            static fn ( $module ) => 'attrium-mod-' . sanitize_html_class($module),
            $this->registry->get_enabled_modules()
        );

        if ( ! $classes ) {
            return;
        }

        $script = sprintf(
            'document.body.classList.add(...%s);',
            wp_json_encode($classes)
        );

        wp_print_inline_script_tag($script);
    }
}
