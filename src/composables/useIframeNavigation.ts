import { useRouter } from 'vue-router'
import { useServerData } from './useServerData'

/**
 * Known Attrium native routes, keyed by admin-relative path → router target path.
 * Any admin page NOT in this list will be shown via iframe.
 * Extend this list as Attrium gains native pages.
 *
 * Values are router *paths* (passed straight to router.push), not route names.
 */
const KNOWN_ATTRIUM_ROUTES: Record<string, string> = {
	'/': '/',
}

export function useIframeNavigation() {
	const router = useRouter()
	const { adminUrl, currentPage } = useServerData()

	/** Check whether a path is handled by a native Attrium view. */
	function isKnownAttriumRoute(path: string): boolean {
		return !!KNOWN_ATTRIUM_ROUTES[path]
	}

	/** Get the admin-relative path (e.g. "edit.php?post_type=page") from a full URL. */
	function extractRelativePath(urlOrPath: string): string {
		// Already relative
		if (!urlOrPath.startsWith('http')) {
			return urlOrPath
		}

		// Strip admin URL prefix
		if (urlOrPath.startsWith(adminUrl)) {
			return urlOrPath.slice(adminUrl.length)
		}

		// Fallback: try to extract path after /wp-admin/
		try {
			const u = new URL(urlOrPath)
			const match = u.pathname.match(/\/wp-admin\/(.+)$/)
			if (match) {
				return match[1] + u.search
			}
			return u.pathname + u.search
		} catch {
			return urlOrPath
		}
	}

	/** Navigate to any admin page — native Attrium view if known, iframe otherwise. */
	function navigateTo(urlOrPath: string) {
		const relativePath = extractRelativePath(urlOrPath)

		// Known native route?
		if (KNOWN_ATTRIUM_ROUTES[relativePath]) {
			router.push(KNOWN_ATTRIUM_ROUTES[relativePath])
			return
		}

		// Otherwise → iframe
		router.push({ name: 'wp-page', query: { path: relativePath } })
	}

	/** Build a full admin URL from a relative path. */
	function buildAdminUrl(relativePath: string): string {
		return adminUrl + relativePath
	}

	/** Auto-navigate to the current WP admin page on initial load. */
	function autoNavigateToCurrentPage() {
		if (!currentPage) return
		const known = KNOWN_ATTRIUM_ROUTES[currentPage]
		if (known) {
			router.replace(known)
		} else {
			router.replace({ name: 'wp-page', query: { path: currentPage } })
		}
	}

	return {
		isKnownAttriumRoute,
		navigateTo,
		extractRelativePath,
		buildAdminUrl,
		autoNavigateToCurrentPage,
		knownRoutes: KNOWN_ATTRIUM_ROUTES,
	}
}
