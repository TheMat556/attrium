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
	logoutUrl: string
	siteUrl: string
	userName: string
	userEmail: string
	canManage: boolean
	screenId: string
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
		logoutUrl: get('logout-url'),
		siteUrl: get('site-url'),
		userName: get('user-name'),
		userEmail: get('user-email'),
		canManage: get('can-manage') === 'true',
		screenId: get('screen-id'),
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
