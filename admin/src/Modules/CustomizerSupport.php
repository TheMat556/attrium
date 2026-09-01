<?php

namespace Attrium\Modules;

use Attrium\Settings\Settings;
use Attrium\Utility\Scripts;

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
        add_action('customize_controls_head', [ $this, 'fonts_style' ]);
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
     * Emit the Inter Variable @font-face on the Customizer.
     *
     * The theme font is bundled by Vite into app/dist/assets/ as part of the
     * Vue shell (src/fonts.css), but that shell is never loaded on customize.php
     * (see Attrium::is_overlay_screen()), so the @font-face is missing there
     * and the whole pane falls back to core's system stack unless we inject it.
     * The woff2 files are already on disk (Vite builds them regardless) — this
     * just wires the @font-face to their hashed, served URLs, resolving the hash
     * from the Vite manifest at runtime so it survives rebuilds. The family is
     * applied to the pane by scss/screens/_customize-shell.scss.
     *
     * The unicode-range/subset list mirrors @fontsource-variable/inter
     * src/fonts.css imports; it is fixed for the Inter Variable font.
     */
    public function fonts_style(): void {
        // subset => unicode-range, keyed the same way fontsource names its files.
        $subsets = [
            'cyrillic-ext' => 'U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F',
            'cyrillic'     => 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116',
            'greek-ext'    => 'U+1F00-1FFF',
            'greek'        => 'U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF',
            'vietnamese'   => 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB',
            'latin-ext'    => 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
            'latin'        => 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
        ];

        $css = '/* Attrium Inter Variable for the Customizer */' . "\n";
        // get_build_asset() returns the file relative to app/dist/, e.g.
        // "assets/inter-…-BOeWTOD4.woff2", so the base is app/dist/.
        $base = ATTRIUM_URL . 'app/dist/';

        foreach ( $subsets as $subset => $range ) {
            $asset_src = 'node_modules/@fontsource-variable/inter/files/inter-' . $subset . '-wght-normal.woff2';
            $asset     = Scripts::get_build_asset($asset_src);
            if ( ! $asset ) {
                continue;
            }

            $css .= '@font-face{' .
                "font-family:'Inter Variable';font-style:normal;font-display:swap;" .
                'font-weight:100 900;' .
                'src:url(' . $base . $asset . ') format("woff2-variations");' .
                'unicode-range:' . $range . '}' . "\n";
        }

        if ( strpos($css, '@font-face') === false ) {
            return;
        }

        // No escaping here: every part of $css is derived from constant subset
        // lists, the Vite manifest's own hashed asset filenames and ATTRIUM_URL
        // (all server-side, never user input), so there is nothing to sanitize.
        // phpcs:ignore WordPress.Security.EscapeOutput
        echo '<style id="attrium-customizer-fonts">' . $css . '</style>';
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
