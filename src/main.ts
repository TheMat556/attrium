import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { applyThemeToHost } from './composables/useTheme'
import router from './router'
import styles from './style.css?inline'

// ── Iframe guard ──────────────────────────────────────────
// Inside a same-origin iframe? Hide WP chrome and bail.
// This catches every case where PHP-side detection fails
// (no Sec-Fetch headers on HTTP, ?attrium=off lost on nav).
if (window !== window.top) {
	const style = document.createElement('style')
	style.textContent =
		'#wpadminbar{display:none!important;}' +
		'#adminmenumain,#adminmenuback,#adminmenuwrap{display:none!important;}' +
		'#wpcontent,#wpfooter{margin-left:0!important;}' +
		'html.wp-toolbar{padding-top:0!important;}' +
		'body{min-width:0!important;}'
	document.head.appendChild(style)
	// Remove the body-hider CSS injected by PHP build_attrium() —
	// WP page content needs to be visible inside the iframe.
	const hider = document.getElementById('attrium-body-hider')
	if (hider) hider.remove()
} else {
	// ── Normal SPA boot ──────────────────────────
	const host = document.createElement('div')
	host.id = 'attrium-host'
	host.className = 'fixed inset-0 z-[2147483647] text-foreground'
	document.body.prepend(host)

	applyThemeToHost()

	const shadow = host.attachShadow({ mode: 'open' })

	const sheet = document.createElement('style')
	sheet.textContent = styles
	shadow.appendChild(sheet)

	const mount = document.createElement('div')
	mount.id = 'attrium-app'
	shadow.appendChild(mount)

	// Portal container for reka-ui components (DropdownMenu, Dialog, etc.)
	const portal = document.createElement('div')
	portal.id = 'attrium-portal'
	shadow.appendChild(portal)

	// Global reference consumed by the reka-ui portal shim (src/lib/reka-ui.ts)
	window.__ATTRIUM_PORTAL__ = portal

	createApp(App).use(createPinia()).use(router).mount(mount)
}
