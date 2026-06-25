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

const removeHider = () => document.querySelector('#attrium-body-hider')?.remove()

// On screens Attrium overrides natively (see src/views/overrides.ts), App.vue
// renders its own view and no wp-content slot is rendered. There is nothing to
// project, so just drop the FOUC hider to reveal the native UI and leave
// #wpcontent where it is. The slot's presence is the single runtime signal for
// "is this screen overridden?" — we don't duplicate the registry lookup here.
const slot = shadow.querySelector('slot[name="wp-content"]')

if (!slot) {
	removeHider()
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
	}
	// If the slot exists but #wpcontent is missing (unexpected), the hider
	// stays so we fail visibly rather than silently dropping page content.
}
