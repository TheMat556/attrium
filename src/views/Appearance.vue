<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { wpFetch } from '@/lib/api'

// Native Attrium settings view (screen id: toplevel_page_attrium). Manages the
// list of admin URLs excluded from Attrium's content styling — the shell still
// wraps those pages, but the embedded WordPress content keeps its native look.
const urls = ref('')
const loading = ref(true)
const saving = ref(false)
const saved = ref(false)
const error = ref('')

onMounted(async () => {
	try {
		const data = await wpFetch<{ urls: string }>('attrium/v1/ignored-urls')
		urls.value = data.urls
	} catch {
		error.value = 'Could not load the ignored URLs.'
	} finally {
		loading.value = false
	}
})

async function save() {
	saving.value = true
	saved.value = false
	error.value = ''
	try {
		const data = await wpFetch<{ urls: string }>('attrium/v1/ignored-urls', {
			method: 'POST',
			body: JSON.stringify({ urls: urls.value }),
		})
		urls.value = data.urls
		saved.value = true
	} catch {
		error.value = 'Could not save the ignored URLs.'
	} finally {
		saving.value = false
	}
}
</script>

<template>
	<div class="flex flex-col gap-6 px-4 py-4 md:px-6 md:py-6">
		<div class="flex flex-col gap-1">
			<h1 class="text-2xl font-semibold tracking-tight">Appearance</h1>
			<p class="text-muted-foreground text-sm">
				Control which admin pages Attrium styles.
			</p>
		</div>

		<Card>
			<CardHeader>
				<CardTitle class="text-base">Ignored URLs</CardTitle>
				<CardDescription>
					One URL or path per line. Any page whose address contains a line is
					excluded from Attrium's content styling — the sidebar, header and
					content card stay, but the page content keeps its native WordPress
					look.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Textarea
					v-model="urls"
					:disabled="loading || saving"
					class="min-h-40 font-mono text-sm"
					placeholder="edit.php?post_type=page&#10;https://example.com/wp-admin/options-general.php"
				/>
				<p v-if="error" class="text-destructive mt-2 text-sm">{{ error }}</p>
			</CardContent>
			<CardFooter class="gap-3">
				<Button :disabled="loading || saving" @click="save">
					{{ saving ? 'Saving…' : 'Save' }}
				</Button>
				<span v-if="saved" class="text-muted-foreground text-sm">Saved.</span>
			</CardFooter>
		</Card>
	</div>
</template>
