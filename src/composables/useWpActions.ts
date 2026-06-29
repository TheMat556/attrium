import { useServerData } from '@/composables/useServerData'

export interface WpActions {
	/** Resolve a wp-admin-relative path (e.g. `post-new.php`) to an absolute URL. */
	adminPath: (path: string) => string
	newPost: () => void
	newPage: () => void
	goDashboard: () => void
	viewSite: () => void
}

/**
 * WordPress navigation actions shared by the header and the command palette.
 *
 * Navigation is a full page reload (window.location) per Attrium convention —
 * the app is not a SPA router. `adminUrl`/`siteUrl` come from the server data
 * bridge (useServerData); if `adminUrl` is missing the helpers no-op rather
 * than throwing on `new URL(path, '')`.
 */
export function useWpActions(): WpActions {
	const { adminUrl, siteUrl } = useServerData()

	function adminPath(path: string): string {
		return new URL(path, adminUrl).href
	}

	function navigate(path: string): void {
		if (!adminUrl) return
		window.location.href = adminPath(path)
	}

	return {
		adminPath,
		newPost: () => navigate('post-new.php'),
		newPage: () => navigate('post-new.php?post_type=page'),
		goDashboard: () => navigate('index.php'),
		viewSite: () => {
			if (!siteUrl) return
			window.open(siteUrl, '_blank', 'noopener,noreferrer')
		},
	}
}
