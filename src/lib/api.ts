import { useServerData } from '@/composables/useServerData'

export async function wpFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
	const { restBase, restNonce } = useServerData()

	const url = endpoint.startsWith('http') ? endpoint : `${restBase}${endpoint}`

	const response = await fetch(url, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			'X-WP-Nonce': restNonce,
			...options.headers,
		},
	})

	if (!response.ok) {
		throw new Error(`WP API error: ${response.status} ${response.statusText}`)
	}

	return response.json()
}
