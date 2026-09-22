<script setup lang="ts">
import AppSidebar from '@/components/AppSidebar.vue'
import FloatingInfoFab from '@/components/FloatingInfoFab.vue'
import SiteHeader from '@/components/SiteHeader.vue'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useServerData } from '@/composables/useServerData'
import { getScreenOverride } from '@/views/overrides'

// A server-reported override screen renders that view instead of the wp-content
// slot; main.ts keys off slot presence. Add new ones in views/overrides.ts.
const { screenId, isIgnored, isPluginPage } = useServerData()
const override = getScreenOverride(screenId)
</script>

<template>
	<SidebarProvider
		class="h-svh overflow-hidden"
		:style="{
      '--sidebar-width': '16rem',
      '--header-height': '3rem',
    }"
	>
		<AppSidebar variant="inset" />
		<SidebarInset class="ml-0 min-h-0 bg-sidebar">
			<SiteHeader />
			<!-- Mobile corner sandwich: below md the rounded scroller splits into a
			static rounded clip mask, a static surface fill in the same grid cell, and
			a square transparent scroller. A rounded *scrolling* layer makes the
			compositor skip painting behind its corner cutouts (raw framebuffer:
			white wedges / blank content). Desktop keeps the single-layer card. -->
			<div
				data-attrium-scroll
				class="bg-background max-md:bg-sidebar flex min-h-0 flex-1 flex-col overflow-y-auto max-md:grid max-md:grid-rows-1 max-md:overflow-clip rounded-xl shadow-sm md:mx-2 md:mb-2"
				:style="
					isIgnored
						? { '--background': 'var(--attrium-ignored-background)' }
						: undefined
				"
			>
				<div
					aria-hidden="true"
					class="hidden rounded-xl bg-background max-md:block max-md:[grid-area:1/1]"
				/>
				<!-- data-attrium-scroll twice: the card for desktop metrics
				(querySelector hits it first), the inner wrapper for the mobile
				scrollbar rules. -->
				<div
					data-attrium-scroll
					class="flex min-h-full shrink-0 flex-col overflow-hidden rounded-xl bg-transparent max-md:min-h-0 max-md:min-w-0 max-md:flex-1 max-md:overflow-y-auto max-md:rounded-none max-md:[grid-area:1/1]"
				>
					<div class="@container/main flex flex-col gap-2">
						<div class="flex flex-col gap-4 md:gap-6">
							<main>
								<component :is="override" v-if="override" />
								<component v-else is="slot" name="wp-content" />
							</main>
						</div>
					</div>
				</div>
			</div>
		</SidebarInset>
		<FloatingInfoFab v-if="!override && isPluginPage" />
	</SidebarProvider>
</template>
