/**
 * The shell's view of the Attrium light/dark decision.
 *
 * The shell no longer decides the theme. `Attrium\Utility\Theme` resolves it
 * pre-paint, in one synchronous inline script in `<head>` that also runs on
 * customize.php, where there is no shell at all. This file only observes the
 * result — the `attrium-dark` class on `<html>` — and mirrors it onto the
 * host.
 *
 * A MutationObserver on the carrier class instead of re-listening to
 * `storage`/`matchMedia`: observing the carrier means the shell holds no
 * copy of the resolution rule and no assumption about which events can
 * change it, so the two can never drift. It also makes the ordering question
 * moot — the PHP listeners are registered in `<head>`, before this bundle
 * exists, so by the time anything could notify us the class is already
 * correct.
 *
 * The mirror onto `#attrium-host` is still needed because CSS variables do
 * not cross the shadow-root boundary (`:host(.dark)` in scss/_tokens.scss),
 * and src/style.css's `@custom-variant dark (&:is(.dark *, :host(.dark) *))`
 * keys every `dark:` utility in the Vue components on that host class.
 * Mirroring is application, not resolution.
 *
 * toggle() only ever writes the explicit values ('light'/'dark'), so 'auto'
 * is now only ever the *absence* of a stored choice.
 */
import { computed, ref } from 'vue'

const STORAGE_KEY = 'attrium-theme'
const HTML_CLASS = 'attrium-dark'

const isCarrierDark = () =>
	document.documentElement.classList.contains(HTML_CLASS)

const dark = ref(isCarrierDark())

export const isDark = computed(() => dark.value)

// Call this after #attrium-host exists to sync the initial state
export function applyThemeToHost(): void {
	const host = document.getElementById('attrium-host')
	if (!host) return
	host.classList.toggle('dark', dark.value)
}

export function toggle(): void {
	const next = !dark.value
	try {
		localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light')
	} catch {
		// Storage can throw in locked-down browsers; the class flip below
		// still applies for this page.
	}
	// Only ever writes explicit values, so 'auto' is now only ever the
	// absence of a stored choice. Do not set dark.value or touch the host
	// here — the observer below does both, so there is exactly one path
	// that updates state.
	document.documentElement.classList.toggle(HTML_CLASS, next)
}

new MutationObserver(() => {
	dark.value = isCarrierDark()
	applyThemeToHost()
}).observe(document.documentElement, { attributeFilter: ['class'] })
