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
		class="h-svh overflow-hidden"
		:style="{
      '--sidebar-width': '16rem',
      '--header-height': '3rem',
    }"
	>
		<AppSidebar variant="inset" />
		<SidebarInset class="ml-0 min-h-0 bg-sidebar">
			<SiteHeader />
			<!-- Mobile corner sandwich: below md the rounded scroller is split
		into three single-responsibility layers. A rounded *scrolling*
		layer makes the compositor skip painting behind its corner
		cutouts (opaque-flag misreport on the mobile path) — leaving raw
		framebuffer there (white wedges, previous-page pixels, invisible
		radius). So: (1) the card is a static rounded mask with
		`overflow: clip` — clip WITHOUT a scroll container (a nested
		`overflow: hidden` scroller makes non-positioned inner content stop
		painting entirely on the same mobile path: blank dashboard);
		(2) a static rounded surface fill paints the face, stacked into
		the same grid cell — it must NOT be absolutely positioned (an
		`absolute` sibling makes non-positioned content stop painting on
		the same path, same symptom); (3) a square transparent inner
		wrapper is the sole scroller (it paints nothing itself, so there
		is nothing to misreport; content is clipped round by the card).
		Same tokens, same radii, same look — every corner pixel is owned
		by a freshly painted layer. The --background override for ignored
		pages still applies (the variable inherits into the surface fill).
		Desktop keeps the single-layer card untouched. -->
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
				<!-- data-attrium-scroll twice on purpose: the card keeps it for
				the desktop styling/metrics (querySelector finds the card
				first), the inner wrapper needs the same scrollbar rules as
				the mobile scroller. -->
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
