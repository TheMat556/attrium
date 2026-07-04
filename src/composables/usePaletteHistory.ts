import { useStorage } from '@vueuse/core'
import { type ComputedRef, computed } from 'vue'

/** A single navigation the user picked from the command palette. */
export interface HistoryEntry {
	/** Stable key — the destination URL (unique per target). */
	id: string
	label: string
	url: string
	/** Dashicon string, resolved to a Lucide component at render via getIcon. */
	icon?: string
	count: number
	/** Epoch ms of the most recent pick. */
	lastUsed: number
}

/** What a caller provides to record() — count/lastUsed are managed internally. */
export type HistoryInput = Pick<HistoryEntry, 'id' | 'label' | 'url' | 'icon'>

export interface PaletteHistory {
	record: (entry: HistoryInput) => void
	recent: ComputedRef<HistoryEntry[]>
	frequent: ComputedRef<HistoryEntry[]>
}

// How many entries each section shows, how many we keep on disk, and the
// minimum pick count before something counts as "frequent".
const SECTION_SIZE = 5
const MAX_STORED = 50
const FREQUENT_MIN_COUNT = 2

// Module-level so every caller shares one reactive, localStorage-backed list.
const history = useStorage<HistoryEntry[]>('attrium-palette-history', [])

/**
 * Tracks command-palette selections in localStorage and exposes them as
 * "recently used" (by time) and "frequently used" (by pick count) lists.
 *
 * Only items the user picks *from the palette* are recorded — recording is
 * driven by the palette's select handler, not a global navigation hook.
 */
export function usePaletteHistory(): PaletteHistory {
	function record(entry: HistoryInput): void {
		const now = Date.now()
		const existing = history.value.find((e) => e.id === entry.id)

		if (existing) {
			// Replace in place with an updated copy (no mutation of the stored
			// object) so the persisted array stays an immutable update.
			history.value = history.value.map((e) =>
				e.id === entry.id
					? { ...e, ...entry, count: e.count + 1, lastUsed: now }
					: e,
			)
			return
		}

		const next = [...history.value, { ...entry, count: 1, lastUsed: now }]

		// Bound storage: keep the most-recently-used MAX_STORED entries.
		history.value = next
			.sort((a, b) => b.lastUsed - a.lastUsed)
			.slice(0, MAX_STORED)
	}

	const recent = computed(() =>
		[...history.value]
			.sort((a, b) => b.lastUsed - a.lastUsed)
			.slice(0, SECTION_SIZE),
	)

	const frequent = computed(() =>
		[...history.value]
			.filter((e) => e.count >= FREQUENT_MIN_COUNT)
			.sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed)
			.slice(0, SECTION_SIZE),
	)

	return { record, recent, frequent }
}
