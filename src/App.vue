<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import SiteHeader from '@/components/SiteHeader.vue'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useIframeNavigation } from '@/composables/useIframeNavigation'

// On initial load, auto-navigate to the current WP admin page
// so the correct page is shown in the content area
const { autoNavigateToCurrentPage } = useIframeNavigation()
onMounted(() => {
	autoNavigateToCurrentPage()
})

// Iframe pages (3rd-party WP admin) need the layout to fill available height
// so the iframe can take 100%. Native Vue views keep editorial spacing.
const route = useRoute()
const isIframeRoute = computed(() => route.name === 'wp-page')

// Only add the flex-height classes for iframe pages;
// keep the original responsive margins/padding for both.
const cardClass = computed(() => (isIframeRoute.value ? 'min-h-0' : ''))
const innerClass = computed(() =>
	isIframeRoute.value
		? 'flex-1 min-h-0 gap-4 py-4 md:gap-6 md:py-6'
		: 'gap-4 py-4 md:gap-6 md:py-6',
)
const mainClass = computed(() =>
	isIframeRoute.value ? 'flex flex-1 min-h-0 flex-col px-4 lg:px-6' : 'px-4 lg:px-6',
)
</script>

<template>
  <SidebarProvider
    :style="{
      '--sidebar-width': 'calc(var(--spacing) * 72)',
      '--header-height': 'calc(var(--spacing) * 12)',
    }"
  >
    <AppSidebar variant="inset" />
    <SidebarInset>
      <SiteHeader />
      <div
        class="bg-background flex flex-1 flex-col rounded-xl shadow-sm md:mx-2 md:mb-2"
        :class="cardClass"
      >
        <div class="@container/main flex flex-1 flex-col gap-2">
          <div
            class="flex flex-col"
            :class="innerClass"
          >
            <main :class="mainClass">
              <router-view />
            </main>
          </div>
        </div>
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>
