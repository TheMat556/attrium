import { nextTick, onMounted, ref } from 'vue'

/**
 * Detects whether the WordPress Screen Options and Help panels exist in the
 * embedded page, and opens/closes them from the Attrium header.
 *
 * WordPress renders `#screen-meta` (containing `#screen-options-wrap` and
 * `#contextual-help-wrap`) and `#screen-meta-links` (the `#show-settings-link`
 * / `#contextual-help-link` toggle buttons) inside `#wpcontent`, which main.ts
 * reparents into `#attrium-host` on every embedded screen. The links are kept
 * hidden by the `screen-meta` SCSS module (`scss/modules/_screen-meta.scss`),
 * but the buttons still exist and still carry the `screenMeta.toggleEvent`
 * click handler bound by wp-admin/common.js.
 *
 * So we don't re-implement the panel toggle: we programmatically click the
 * hidden button, and WordPress's own machinery slides the real panel open or
 * closed (aria-expanded, screen:options:open/close events, jQuery animation).
 * A programmatic .click() fires jQuery handlers even on display:none elements,
 * so nothing needs to be unhidden.
 *
 * The whole feature is gated on the `attrium-mod-screen-meta` body class — the
 * same gate the SCSS module uses. If an admin disables the module via the
 * `attrium_enabled_modules` filter, the links stay visible AND we stay quiet,
 * so there is never a double entry point into the panels.
 *
 * Both panels are only present when the page is actually embedded in the shell
 * — on natively overridden screens #wpcontent is never moved into the host, so
 * the slot check below hides the whole feature automatically.
 *
 * Detection is a one-shot on mount, which is correct because navigation is a
 * full page reload (window.location, see useWpActions.ts) — not an SPA router —
 * so this composable remounts alongside the header on every screen and always
 * evaluates against the freshly loaded DOM.
 */
export function useScreenMeta() {
	const canShowOptions = ref(false)
	const canShowHelp = ref(false)

	onMounted(async () => {
		if (!document.body.classList.contains('attrium-mod-screen-meta')) return

		const host = document.getElementById('attrium-host')
		if (!host) return

		// onMounted fires during createApp().mount(), which runs BEFORE main.ts
		// moves #wpcontent into #attrium-host (that reparent is synchronous but
		// happens after mount() returns). nextTick resolves after the current
		// task, so the embedded page is already in the host by then.
		await nextTick()

		// main.ts keys "is this screen overridden?" off the wp-content slot's
		// presence in the shadow root (see src/App.vue + src/main.ts). When the
		// slot is absent, #wpcontent is never moved into the host, so the
		// feature stays off on natively-overridden screens.
		if (!host.shadowRoot?.querySelector('slot[name="wp-content"]')) return

		canShowOptions.value = !!host.querySelector(
			'#wpcontent #screen-options-wrap',
		)
		canShowHelp.value = !!host.querySelector('#wpcontent #contextual-help-wrap')
	})

	function toggle(id: 'show-settings-link' | 'contextual-help-link'): void {
		document.getElementById(id)?.click()
	}

	return {
		canShowOptions,
		canShowHelp,
		openScreenOptions: () => toggle('show-settings-link'),
		openHelp: () => toggle('contextual-help-link'),
	}
}
