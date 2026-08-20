import { nextTick, onMounted, ref } from 'vue'

/**
 * Detects whether the WordPress Screen Options and Help panels exist in the
 * embedded page, and opens/closes them from the Attrium header.
 *
 * WordPress renders `#screen-meta` (containing `#screen-options-wrap` and
 * `#contextual-help-wrap`) and `#screen-meta-links` (the `#show-settings-link`
 * / `#contextual-help-link` toggle buttons) inside `#wpcontent`, which main.ts
 * reparents into `#attrium-host` on every embedded screen. The links are kept
 * hidden by `scss/screens/_base.scss` (`#screen-meta-links { display: none }`),
 * but the buttons still exist and still carry the `screenMeta.toggleEvent`
 * click handler bound by wp-admin/common.js.
 *
 * So we don't re-implement the panel toggle: we programmatically click the
 * hidden button, and WordPress's own machinery slides the real panel open or
 * closed (aria-expanded, screen:options:open/close events, jQuery animation).
 * A programmatic .click() fires jQuery handlers even on display:none elements,
 * so nothing needs to be unhidden.
 *
 * Both panels are only present when the page is actually embedded in the shell
 * — on natively overridden screens #wpcontent is never moved into the host, so
 * the containment check below hides the whole feature automatically.
 */
export function useScreenMeta() {
	const canShowOptions = ref(false)
	const canShowHelp = ref(false)

	onMounted(async () => {
		// onMounted fires during createApp().mount(), which runs BEFORE main.ts
		// moves #wpcontent into #attrium-host (that reparent is synchronous but
		// happens after mount() returns). nextTick resolves after the current
		// task, so the embedded page is already in the host by then.
		await nextTick()

		const host = document.getElementById('attrium-host')
		if (!host) return
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
