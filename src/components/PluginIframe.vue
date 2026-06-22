<script setup lang="ts">
import { AlertCircle, ExternalLink, Home, LoaderCircle } from '@lucide/vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'

const props = defineProps<{
	/** Full admin URL to load in the iframe */
	url: string
}>()

const emit = defineEmits<{
	/** Real document title read from the loaded WP page. */
	title: [value: string]
}>()

const router = useRouter()

// ── State ──────────────────────────────────────────
const iframeRef = ref<HTMLIFrameElement | null>(null)
const status = ref<'loading' | 'loaded' | 'error'>('loading')

// ── Iframe Load Handlers ───────────────────────────
function onIframeLoad() {
	const iframe = iframeRef.value
	if (!iframe) return

	let doc: Document | null = null
	try {
		doc = iframe.contentDocument || iframe.contentWindow?.document || null
	} catch {
		// Same-origin access denied (cross-origin redirect, X-Frame-Options, etc.)
		status.value = 'error'
		return
	}

	if (!doc) {
		status.value = 'error'
		return
	}

	// WP chrome (admin bar, side menu, margins) is hidden server-side in
	// Attrium::hide_chrome_in_iframe() — printed in admin_head before paint,
	// so there's no flash and nothing to inject here.

	// Surface the real page title (WP format: "Posts ‹ Site — WordPress").
	// Take the leading segment before the " ‹ " separator.
	const rawTitle = doc.title?.trim()
	if (rawTitle) {
		emit('title', rawTitle.split(' ‹ ')[0].trim())
	}

	status.value = 'loaded'
}

function onIframeError() {
	status.value = 'error'
}

function openInNewTab() {
	window.open(props.url, '_blank')
}

function goToDashboard() {
	router.push('/')
}
</script>

<template>
  <div class="flex h-full w-full flex-col rounded-lg overflow-hidden">
    <!-- Loading State -->
    <div
      v-if="status === 'loading'"
      class="flex flex-1 items-center justify-center"
    >
      <LoaderCircle class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <!-- Error State -->
    <div
      v-if="status === 'error'"
      class="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-destructive/20 bg-destructive/5 p-8 text-center"
    >
      <AlertCircle class="h-12 w-12 text-destructive" />
      <h3 class="text-lg font-semibold">Failed to load page</h3>
      <p class="max-w-md text-sm text-muted-foreground">
        The page could not be loaded inside the admin panel. You can open it in a new
        tab or return to the dashboard.
      </p>
      <div class="flex gap-3">
        <Button variant="outline" @click="goToDashboard">
          <Home class="mr-2 h-4 w-4" />
          Dashboard
        </Button>
        <Button variant="default" @click="openInNewTab">
          <ExternalLink class="mr-2 h-4 w-4" />
          Open in New Tab
        </Button>
      </div>
    </div>

    <!-- Loaded State -->
    <iframe
      v-show="status === 'loaded'"
      ref="iframeRef"
      :src="url"
      class="h-full w-full border-0"
      frameborder="0"
      @load="onIframeLoad"
      @error="onIframeError"
    />
  </div>
</template>
