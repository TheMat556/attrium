// @font-face rules for Inter Variable — imported separately from style.css
// so Vite resolves them into a light-DOM CSS bundle that PHP can serve.
// The Shadow DOM consumes the font via the --font-sans CSS variable.
import './fonts.css'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { applyThemeToHost } from './composables/useTheme'
import styles from './style.css?inline'

// The host element covers the viewport and holds the shadow root (Vue app)
// plus the slotted WordPress content. It is NOT click-through — the content
// lives inside it now, projected via a <slot> element.
const host = document.createElement('div')
host.id = 'attrium-host'
host.style.position = 'fixed'
host.style.inset = '0'
host.style.zIndex = '50'
host.style.overflowY = 'auto'
document.body.prepend(host)

applyThemeToHost()

const shadow = host.attachShadow({ mode: 'open' })

const sheet = document.createElement('style')
sheet.textContent = styles
shadow.appendChild(sheet)

// Copy the dashicons stylesheet into the shadow root so font-family:
// dashicons resolves for toolbar icons rendered inside the shadow tree.
const dashicons = document.querySelector<HTMLLinkElement>('link#dashicons-css')
if (dashicons) {
	const link = document.createElement('link')
	link.rel = 'stylesheet'
	link.href = dashicons.href
	shadow.appendChild(link)
}

const mount = document.createElement('div')
mount.id = 'attrium-app'
shadow.appendChild(mount)

// Portal container for reka-ui components (DropdownMenu, Dialog, etc.)
const portal = document.createElement('div')
portal.id = 'attrium-portal'
shadow.appendChild(portal)

// Global reference consumed by the reka-ui portal shim (src/lib/reka-ui.ts)
window.__ATTRIUM_PORTAL__ = portal

// Mount the Vue app. App.vue renders a real <slot name="wp-content"> element
// into the shadow DOM. mount() runs synchronously, so the slot exists right
// after this call — but we still verify it below rather than assume timing.
createApp(App).use(createPinia()).mount(mount)

const removeHider = () =>
	document.querySelector('#attrium-body-hider')?.remove()

// ── Plugin overlay interception ─────────────────────────────────────
// WordPress plugins commonly inject overlays (chat widgets, modals,
// drawers) as children of #wpwrap or #wpadminbar using position:fixed.
// Whether the current screen has a native override or uses the wp-content
// slot, these overlays end up inside the hidden WP chrome and need to be
// relocated to <body> so they can cover the full viewport.
//
// This runs unconditionally — before the slot check below — so that
// overlays are caught even on natively-overridden screens (Dashboard,
// etc.) where #wpcontent is never moved into the host.
;(() => {
	function isPositioned(el: Element): boolean {
		const pos = getComputedStyle(el).position
		return pos === 'fixed' || pos === 'absolute'
	}

	function relocateOverlay(el: Element): void {
		if ((el as HTMLElement).dataset.attriumRelocated === 'true') return
		;(el as HTMLElement).dataset.attriumRelocated = 'true'
		document.body.appendChild(el)
	}

	// Plugins commonly inject overlays as direct children of #wpwrap
	// or #wpadminbar (e.g. snn-chat-overlay). Scan direct children
	// only — overlays are virtually always injected at the container
	// level, not deeply nested. A full querySelector-all with
	// getComputedStyle would force layout on every descendant.
	for (const id of ['wpwrap', 'wpadminbar']) {
		const container = document.getElementById(id)
		if (!container) continue
		for (const el of Array.from(container.children)) {
			if (isPositioned(el)) relocateOverlay(el)
		}
	}

	for (const id of ['wpadminbar', 'wpwrap']) {
		const container = document.getElementById(id)
		if (!container) continue

		new MutationObserver((records) => {
			for (const record of records) {
				for (const node of record.addedNodes) {
					if (!(node instanceof Element)) continue
					if (isPositioned(node) && node.parentElement) {
						relocateOverlay(node)
					}
				}
			}
		}).observe(container, { childList: true })
	}
})()

// On screens Attrium overrides natively (see src/views/overrides.ts), App.vue
// renders its own view and no wp-content slot is rendered. There is nothing to
// project, so just drop the FOUC hider to reveal the native UI and leave
// #wpcontent where it is. The slot's presence is the single runtime signal for
// "is this screen overridden?" — we don't duplicate the registry lookup here.
const slot = shadow.querySelector('slot[name="wp-content"]')

if (!slot) {
	removeHider()
	clearTimeout(window.__ATTRIUM_WATCHDOG__)
} else {
	// Move the WordPress content (#wpcontent) from its original position in
	// #wpwrap into #attrium-host as a light-DOM child. The slot="wp-content"
	// attribute makes the shadow DOM's <slot name="wp-content"> project it
	// into the SidebarInset content card. Because #wpcontent stays in the
	// light DOM, all WordPress CSS continues to apply to it.
	const wpcontent = document.querySelector('#wpcontent')

	if (wpcontent) {
		wpcontent.setAttribute('slot', 'wp-content')
		host.appendChild(wpcontent)

		// Content is projected and visible now.
		removeHider()
		clearTimeout(window.__ATTRIUM_WATCHDOG__)
	}
	// If the slot exists but #wpcontent is missing (unexpected), the hider
	// stays so we fail visibly rather than silently dropping page content.
}
