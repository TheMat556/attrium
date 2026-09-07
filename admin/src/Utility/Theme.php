<?php

namespace Attrium\Utility;

defined('ABSPATH') || exit();

/**
 * The single source of the Attrium light/dark decision.
 *
 * Everything that can change the answer is resolved here and only here: the
 * stored preference ('attrium-theme' in localStorage) and the
 * `prefers-color-scheme` media query. The rule: an absent key or 'auto'
 * follows prefers-color-scheme; 'light'/'dark' are explicit overrides. The
 * shell's toggle() in src/composables/useTheme.ts only ever writes the
 * explicit values, so 'auto' is now only ever the absence of a choice.
 *
 * This must be a synchronous inline script: it has to run before first
 * paint, and customize.php loads no Attrium bundle at all — the Vue shell
 * never boots there, so the resolution cannot live in the bundle.
 *
 * The script sets/clears 'attrium-dark' on <html>, never on
 * #attrium-host: the host does not exist pre-paint (src/main.ts creates it),
 * and <html> always does. scss/_tokens.scss carries the dark palette under
 * html.attrium-dark, so the whole document resolves dark tokens from the
 * first paint — no light flash.
 *
 * The storage event (another tab changed the preference) and the media
 * query's change event (the OS switched) are listened for here, not in the
 * shell: this script is the only resolver, so it owns every input that can
 * change the answer. src/composables/useTheme.ts watches the resulting class
 * with a MutationObserver, so the shell needs no knowledge of the rule or of
 * when it changes — and it works identically on customize.php, where there
 * is no shell at all.
 *
 * CSS variables do not cross the shadow-root boundary, so the shell still
 * mirrors this class onto #attrium-host for :host(.dark); that mirror is
 * application, not resolution.
 */
class Theme {
    public static function print_resolver_script(): void {
        // One resolver per page: a second call would register duplicate
        // storage / matchMedia listeners. apply() is idempotent, so this is
        // hygiene rather than correctness — and keeps the pre-paint output
        // to a single script tag.
        static $printed = false;

        if ( $printed ) {
            return;
        }

        $printed = true;

        // The 'attrium-theme' / 'attrium-dark' literals below are duplicated
        // in src/composables/useTheme.ts (the shell's TS view of the same
        // decision); theme-resolution.spec.ts pins the contract behaviorally
        // across both surfaces, so a drift fails CI instead of shipping.
        $script = <<<'JS'
        (function () {
            var query = window.matchMedia('(prefers-color-scheme: dark)');

            function apply() {
                var stored;
                try { stored = localStorage.getItem('attrium-theme'); } catch (e) {}
                var auto = !stored || stored === 'auto';
                var dark = stored === 'dark' || (auto && query.matches);
                document.documentElement.classList.toggle('attrium-dark', dark);
            }

            apply();

            window.addEventListener('storage', function (e) {
                if (e.key === 'attrium-theme') apply();
            });

            query.addEventListener('change', apply);
        })();
        JS;

        wp_print_inline_script_tag($script);
    }
}
