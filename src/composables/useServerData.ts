export interface MenuChild {
	title: string
	slug: string
	url: string
	badge?: string
}

export interface MenuItem {
	title: string
	slug: string
	url: string
	icon: string
	badge?: string
	children: MenuChild[]
}

export interface ServerData {
	restBase: string
	restNonce: string
	adminUrl: string
	siteUrl: string
	userName: string
	userEmail: string
	canManage: boolean
	currentScreen: Record<string, string> | null
	currentPage: string
	pluginVersion: string
	pluginBase: string
	menu: MenuItem[]
}

export function useServerData(): ServerData {
	const el = document.getElementById('attrium-data')

	const get = (attr: string, fallback = ''): string => {
		return el?.getAttribute(attr) || fallback
	}

	return {
		restBase: get('rest-base'),
		restNonce: get('rest-nonce'),
		adminUrl: get('admin-url'),
		siteUrl: get('site-url'),
		userName: get('user-name'),
		userEmail: get('user-email'),
		canManage: get('can-manage') === 'true',
		currentScreen: parseJson(get('current-screen')),
		currentPage: get('current-page'),
		menu: parseMenu(get('menu')),
		pluginVersion: get('plugin-version'),
		pluginBase: get('plugin-base'),
	}
}

function parseMenu(str: string): MenuItem[] {
	if (!str) return []
	try {
		return JSON.parse(str)
	} catch {
		return []
	}
}

function parseJson(str: string): Record<string, string> | null {
	if (!str) return null
	try {
		return JSON.parse(str)
	} catch {
		return null
	}
}
