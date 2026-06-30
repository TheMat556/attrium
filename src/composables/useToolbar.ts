import { onMounted, type Ref, ref } from 'vue'

export interface ToolbarIcon {
	kind: 'html' | 'css'
	html?: string
	content?: string
	fontFamily?: string
	backgroundImage?: string
}

export interface ToolbarChild {
	id: string
	name: string
	href: string
	target: string
	children: ToolbarChild[]
}

export interface ToolbarItem {
	id: string
	name: string
	href: string
	target: string
	icon: ToolbarIcon | null
	children: ToolbarChild[]
}

/**
 * WordPress core toolbar node IDs that should not be surfaced in the
 * Attrium header — Attrium already provides alternatives for these.
 */
const CORE_SKIP_IDS = new Set([
	'wp-admin-bar-wp-logo',
	'wp-admin-bar-site-name',
	'wp-admin-bar-my-account',
	'wp-admin-bar-my-sites',
	'wp-admin-bar-updates',
	'wp-admin-bar-comments',
	'wp-admin-bar-new-content',
	'wp-admin-bar-edit',
	'wp-admin-bar-view',
	'wp-admin-bar-search',
	'wp-admin-bar-customize',
	'wp-admin-bar-menu-toggle',
	'wp-admin-bar-top-secondary',
	'wp-admin-bar-root-default',
])

/**
 * CSS `content` values differ between browsers:
 * - Chrome returns the resolved Unicode character (e.g. "")
 * - Firefox returns the CSS literal string (e.g. `"\f101"`)
 */
function decodeCssContent(raw: string): string {
	const trimmed = raw.replace(/^["']|["']$/g, '')
	const hex = trimmed.match(/^\\([0-9a-fA-F]+)$/)
	if (hex) {
		return String.fromCodePoint(Number.parseInt(hex[1], 16))
	}
	return trimmed
}

function extractIcon(li: HTMLLIElement): ToolbarIcon | null {
	const abItem =
		li.querySelector<HTMLElement>(':scope > .ab-item > .ab-icon') ??
		li.querySelector<HTMLElement>(':scope > .ab-item')
	if (!abItem) return null

	// Inline SVG or <img>
	const svg = abItem.querySelector<SVGSVGElement>('svg')
	if (svg) return { kind: 'html', html: svg.outerHTML }
	const img = abItem.querySelector<HTMLImageElement>('img')
	if (img) return { kind: 'html', html: img.outerHTML }

	// Decorative inline child (not a label) — e.g. SNN AI Chat's
	// <span style="background:gradient; -webkit-background-clip:text">✦</span>
	// Capture as HTML so the inline style and text content are preserved.
	const children = Array.from(abItem.children).filter(
		(c) =>
			!c.classList.contains('ab-label') &&
			!c.classList.contains('screen-reader-text') &&
			!c.classList.contains('ab-empty-item'),
	)
	if (children.length === 1) {
		const text = children[0].textContent?.trim() ?? ''
		if (text.length < 10) {
			return { kind: 'html', html: children[0].outerHTML }
		}
	}

	// background-image on .ab-item or a descendant (Yoast uses a data-URI
	// background-image on a child div inside .ab-item).
	for (const el of [abItem, ...abItem.querySelectorAll<HTMLElement>('*')]) {
		const bg = el.style.backgroundImage || getComputedStyle(el).backgroundImage
		if (bg && bg !== 'none') {
			return { kind: 'css', backgroundImage: bg }
		}
	}

	// CSS ::before icon (dashicons, admin-bar fonts, etc.)
	const abIcon =
		li.querySelector<HTMLElement>(':scope > .ab-item > .ab-icon') ?? abItem
	const before = getComputedStyle(abIcon, '::before')
	const content = before.content
	if (content && content !== 'none' && content !== '') {
		const icon: ToolbarIcon = {
			kind: 'css',
			content: decodeCssContent(content),
		}
		const ff = before.fontFamily
		if (ff && ff !== 'none') icon.fontFamily = ff
		const bg = before.backgroundImage
		if (bg && bg !== 'none') icon.backgroundImage = bg
		return icon
	}

	return null
}

function scrapeChild(li: HTMLLIElement): ToolbarChild | null {
	const link = li.querySelector<HTMLAnchorElement>(':scope > .ab-item')
	const id = li.id || ''
	const name =
		link?.querySelector<HTMLElement>('.ab-label')?.innerText ??
		link?.querySelector<HTMLElement>('.screen-reader-text')?.innerText ??
		link?.innerText ??
		''
	const href = link?.getAttribute('href') ?? ''
	const target = link?.getAttribute('target') ?? ''

	const sub = li.querySelector<HTMLElement>(
		':scope > .ab-sub-wrapper > .ab-submenu',
	)
	const children = sub ? scrapeChildren(sub) : []

	return { id, name, href, target, children }
}

function scrapeChildren(ul: HTMLElement): ToolbarChild[] {
	const items: ToolbarChild[] = []
	for (const li of ul.querySelectorAll<HTMLLIElement>(':scope > li')) {
		if (CORE_SKIP_IDS.has(li.id)) continue
		const child = scrapeChild(li)
		if (child) items.push(child)
	}
	return items
}

function scrapeItem(li: HTMLLIElement): ToolbarItem | null {
	const link = li.querySelector<HTMLAnchorElement>(':scope > .ab-item')
	const id = li.id || ''
	const name =
		link?.querySelector<HTMLElement>('.ab-label')?.innerText ??
		link?.querySelector<HTMLElement>('.screen-reader-text')?.innerText ??
		link?.innerText ??
		''
	const href = link?.getAttribute('href') ?? ''
	const target = link?.getAttribute('target') ?? ''

	const icon = extractIcon(li)

	const sub = li.querySelector<HTMLElement>(
		':scope > .ab-sub-wrapper > .ab-submenu',
	)
	const children = sub ? scrapeChildren(sub) : []

	return { id, name, href, target, icon, children }
}

function scrapeToolbar(): ToolbarItem[] {
	const bar = document.getElementById('wpadminbar')
	if (!bar) return []

	const items: ToolbarItem[] = []

	const defaultList = bar.querySelector<HTMLElement>(
		'#wp-admin-bar-root-default',
	)
	if (defaultList) {
		for (const li of defaultList.querySelectorAll<HTMLLIElement>(
			':scope > li',
		)) {
			if (CORE_SKIP_IDS.has(li.id)) continue
			const item = scrapeItem(li)
			if (item) items.push(item)
		}
	}

	const secondaryList = bar.querySelector<HTMLElement>(
		'#wp-admin-bar-top-secondary',
	)
	if (secondaryList) {
		for (const li of secondaryList.querySelectorAll<HTMLLIElement>(
			':scope > li',
		)) {
			if (CORE_SKIP_IDS.has(li.id)) continue
			const item = scrapeItem(li)
			if (item) items.push(item)
		}
	}

	return items
}

function dispatchMouseSequence(id: string): void {
	const node = document.getElementById(id)
	if (!node) return

	const opts: MouseEventInit = { bubbles: true, cancelable: true, view: window }
	node.dispatchEvent(new MouseEvent('mousedown', opts))
	node.dispatchEvent(new MouseEvent('mouseup', opts))
	node.dispatchEvent(new MouseEvent('click', opts))
}

function hasRealHref(item: { href: string }): boolean {
	return (
		item.href.length > 0 &&
		item.href !== '#' &&
		!item.href.startsWith('javascript:')
	)
}

/**
 * Handle a toolbar-item click: navigate for real links, proxy to the live
 * DOM node for JS-bound plugin handlers.
 */
export function handleToolbarClick(item: ToolbarItem | ToolbarChild): void {
	if (hasRealHref(item)) {
		if (item.target === '_blank') {
			window.open(item.href, '_blank', 'noopener,noreferrer')
		} else {
			window.location.href = item.href
		}
		return
	}
	dispatchMouseSequence(item.id)
}

/**
 * Reactive model of 3rd-party WordPress admin bar items.
 *
 * Scrapes `#wpadminbar` (light DOM) once on mount, filtering out WordPress
 * core nodes. Exposes a `rescan()` escape hatch for late-injected nodes.
 */
export function useToolbar(): {
	items: Ref<ToolbarItem[]>
	rescan: () => void
} {
	const items = ref<ToolbarItem[]>([])

	function rescan() {
		items.value = scrapeToolbar()
	}

	onMounted(rescan)

	return { items, rescan }
}
