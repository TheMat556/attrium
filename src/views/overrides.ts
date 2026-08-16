import { type Component, defineAsyncComponent } from 'vue'
import Dashboard from './Dashboard.vue'

/**
 * Registry of native Attrium views that replace the slotted WordPress content.
 *
 * Key   = WordPress `WP_Screen->id` (emitted server-side as the `screen-id`
 *         data attribute in admin/src/App/Attrium.php). Examples: 'dashboard',
 *         'plugins', 'edit-post', 'options-general'. This id is the contract
 *         between PHP and the client — keep both sides in sync.
 * Value = Vue component to render instead of the embedded WP page.
 *
 * To override a new page: add one entry here and create its view file. App.vue
 * looks the screen up automatically and never needs to change.
 *
 * For heavy views, wrap a lazy import in defineAsyncComponent so Vue resolves
 * the chunk before rendering (a bare `() => import()` is treated as a
 * functional component and renders the returned Promise as text):
 *   plugins: defineAsyncComponent(() => import('./Plugins.vue')),
 */
export const screenOverrides: Record<string, Component> = {
	dashboard: Dashboard,
	toplevel_page_attrium: defineAsyncComponent(() => import('./Appearance.vue')),
}

/** Resolve the override view for a screen id, or undefined to embed WP. */
export function getScreenOverride(screenId: string): Component | undefined {
	return screenOverrides[screenId]
}
