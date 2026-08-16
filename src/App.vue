<script setup lang="ts">
import AppSidebar from '@/components/AppSidebar.vue'
import FloatingInfoFab from '@/components/FloatingInfoFab.vue'
import SiteHeader from '@/components/SiteHeader.vue'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useServerData } from '@/composables/useServerData'
import { getScreenOverride } from '@/views/overrides'

// When the server reports a screen Attrium overrides natively, render that
// view instead of the slotted WP content. The slot is only rendered when there
// is no override — main.ts keys off the slot's presence to decide whether to
// move #wpcontent into it. Add new overrides in src/views/overrides.ts.
const { screenId, isIgnored, isPluginPage } = useServerData()
const override = getScreenOverride(screenId)
</script>

<template>
	<SidebarProvider
		:style="{
      '--sidebar-width': '16rem',
      '--header-height': '3rem',
    }"
	>
		<AppSidebar variant="inset" />
		<SidebarInset class="ml-0">
			<SiteHeader />
			<div class="flex flex-1 flex-col rounded-xl shadow-sm md:mx-2 md:mb-2">
				<div
					class="bg-background flex flex-1 flex-col rounded-xl overflow-hidden"
					:style="
						isIgnored
							? { '--background': 'var(--attrium-ignored-background)' }
							: undefined
					"
				>
					<div class="@container/main flex flex-1 flex-col gap-2">
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
