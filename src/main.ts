import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import styles from './style.css?inline'
import router from './router'
import { applyThemeToHost } from './composables/useTheme'

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

// @ts-expect-error — global reference for portal components
window.__ATTRIUM_PORTAL__ = portal

createApp(App).use(createPinia()).use(router).mount(mount)
