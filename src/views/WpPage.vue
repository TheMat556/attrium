<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import PluginIframe from '@/components/PluginIframe.vue'
import { Skeleton } from '@/components/ui/skeleton'
import { useServerData } from '@/composables/useServerData'

const route = useRoute()
const { adminUrl } = useServerData()

/** The relative path from the query string, e.g. "edit.php?post_type=product" */
const relativePath = computed<string>(() => {
	const path = route.query.path
	return (Array.isArray(path) ? path[0] : path) || ''
})

/** Full admin URL to load in the iframe.
 *  Adds ?attrium=off so Attrium doesn't re-initialize inside the iframe. */
const iframeUrl = computed<string>(() => {
	const base = adminUrl + relativePath.value
	const separator = relativePath.value.includes('?') ? '&' : '?'
	return `${base + separator}attrium=off`
})

/** Real title read from the loaded iframe document; empty until it loads. */
const iframeTitle = ref('')

// Clear the resolved title when navigating to a different page so the
// fallback shows again until the new iframe reports its own title.
watch(relativePath, () => {
	iframeTitle.value = ''
})

/** Whether the title has been resolved from the iframe yet. */
const titleLoaded = computed(() => !!iframeTitle.value)
</script>

<template>
	<div class="flex min-h-0 flex-1 flex-col gap-4">
		<!-- Page Header -->
		<div class="flex items-center gap-2">
			<div class="flex-1">
				<Skeleton
					v-if="!titleLoaded"
					class="h-8 w-48"
				/>
				<h1
					v-else
					class="text-2xl font-bold"
				>
					{{ iframeTitle }}
				</h1>
			</div>
		</div>

		<!-- Iframe Content -->
		<!-- key forces a full remount per URL so iframe + status reset cleanly -->
		<PluginIframe
			:key="iframeUrl"
			:url="iframeUrl"
			class="min-h-0 flex-1"
			@title="iframeTitle = $event"
		/>
	</div>
</template>
