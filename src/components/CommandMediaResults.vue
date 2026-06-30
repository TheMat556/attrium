<script setup lang="ts">
import { Image } from '@lucide/vue'
import { useDebounceFn } from '@vueuse/core'
import { ref, watch } from 'vue'
import { CommandGroup, CommandItem, useCommand } from '@/components/ui/command'
import type { HistoryInput } from '@/composables/usePaletteHistory'
import { useWpActions } from '@/composables/useWpActions'
import { wpFetch } from '@/lib/api'

interface WpMedia {
	id: number
	title: { rendered: string }
	media_type: string
	mime_type: string
}

// Don't hit the API until the query is meaningful, and cap the result list.
const MIN_QUERY_LENGTH = 2
const PER_PAGE = 8
const DEBOUNCE_MS = 250

const emit = defineEmits<{ select: [entry: HistoryInput] }>()

// useCommand resolves only inside <Command> — this component must be rendered
// within <CommandList>. filterState.search is the live palette query.
const { filterState } = useCommand()
const { adminPath } = useWpActions()

const results = ref<WpMedia[]>([])

// Monotonic request id: a slow response is discarded if a newer query started
// after it, so out-of-order responses never overwrite fresher results.
let requestSeq = 0

const search = useDebounceFn(async (query: string) => {
	if (query.length < MIN_QUERY_LENGTH || query !== filterState.search) {
		return
	}
	const seq = ++requestSeq
	const params = new URLSearchParams({
		search: query,
		per_page: String(PER_PAGE),
		_fields: 'id,title,media_type,mime_type',
	})

	try {
		const media = await wpFetch<WpMedia[]>(`/wp/v2/media?${params}`)
		if (seq === requestSeq) {
			results.value = media
		}
	} catch {
		// Never let a failed media lookup break the palette — just show nothing.
		if (seq === requestSeq) {
			results.value = []
		}
	}
}, DEBOUNCE_MS)

watch(
	() => filterState.search,
	(query) => {
		if (query.length < MIN_QUERY_LENGTH) {
			requestSeq++ // invalidate any in-flight request
			results.value = []
			return
		}
		search(query)
	},
)

function mediaTitle(item: WpMedia): string {
	return item.title.rendered || '(no title)'
}

function selectMedia(item: WpMedia): void {
	const url = adminPath(`post.php?post=${item.id}&action=edit`)
	emit('select', {
		id: url,
		label: mediaTitle(item),
		url,
		icon: 'dashicons-admin-media',
	})
}
</script>

<template>
	<CommandGroup
		v-if="filterState.search.length >= MIN_QUERY_LENGTH && results.length"
		heading="Media"
	>
		<!--
      Key by id + search so each query remounts items: CommandItem snapshots its
      textContent on mount only. The sr-only search span makes the item's text
      contain the query, so reka-ui's client filter never re-hides a result the
      WP API already matched (WP also matches filename/caption, not just title).
    -->
		<CommandItem
			v-for="item in results"
			:key="`${item.id}-${filterState.search}`"
			:value="mediaTitle(item)"
			@select="selectMedia(item)"
		>
			<Image />
			{{ mediaTitle(item) }}
			<span class="sr-only">{{ filterState.search }}</span>
		</CommandItem>
	</CommandGroup>
</template>
