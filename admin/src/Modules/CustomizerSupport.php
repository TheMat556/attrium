<?php

namespace Attrium\Modules;

use Attrium\Settings\Settings;
use Attrium\Utility\Scripts;
use Attrium\Utility\Theme;

defined('ABSPATH') || exit();

/**
 * Customizer (customize.php) compatibility.
 *
 * The Customizer is a native full-screen overlay and is excluded from the
 * Attrium Vue shell (see Attrium::is_overlay_screen()). It does not go through
 * admin-header.php, so the module registry's admin_enqueue_scripts /
 * admin_body_class hooks never fire there. This class re-registers the theme
 * on the customizer's own hooks:
 * - the per-module CSS chunks and the shared build CSS (for the Inter
 *   @font-face) are enqueued on customize_controls_enqueue_scripts,
 * - light/dark resolution is the shared pre-paint script in
 *   Attrium\Utility\Theme — the same one Attrium prints on regular admin
 *   pages — so customize.php and the shell cannot disagree,
 * - the attrium-mod-* body classes are an inline script on
 *   customize_controls_print_footer_scripts.
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
        add_action('customize_controls_head', [ Theme::class, 'print_resolver_script' ]);
        add_action('customize_controls_print_footer_scripts', [ $this, 'body_classes' ]);
    }

    /**
     * Enqueue the theme CSS chunks on the Customizer.
     *
     * Reuses ModuleRegistry::enqueue_styles() so the module toggles apply
     * identically on customize.php. wp_enqueue_style is idempotent by handle,
     * so sharing the enqueue with the admin hook is safe if both ever fire.
     *
     * Also enqueues the shared build stylesheet: the Customizer needs the
     * Inter Variable @font-face that Vite emits into the shared build CSS from
     * src/fonts.css (imported by src/main.ts), because the shell that normally
     * carries it never loads on customize.php. scss/screens/_customize-shell.scss
     * applies the family to the pane, so without this the whole pane falls back
     * to core's system stack. This replaces a former hand-built PHP @font-face
     * table that duplicated fontsource's unicode-range map.
     */
    public function enqueue_styles(): void {
        $this->registry->enqueue_styles();
        Scripts::enqueue_build_style('src/main.ts');
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
     *
     * The classes come from ModuleRegistry::get_module_classes(), so the
     * attrium-mod- prefix and sanitization live in one place.
     *
     * A classic inline script on this hook — rather than a deferred module —
     * is deliberate. This runs during body parse, before the parser reaches
     * core's footer bundles and well before DOMContentLoaded; a deferred module
     * would only run once the whole document is parsed, widening the window in
     * which the overlay markup can paint without the reskin gate
     * (attrium-mod-screens) on <body>.
     */
    public function body_classes(): void {
        $classes = $this->registry->get_module_classes();

        if ( ! $classes ) {
            return;
        }

        wp_print_inline_script_tag(
            sprintf(
                'document.body.classList.add(...%s);',
                wp_json_encode($classes)
            )
        );
    }
}
