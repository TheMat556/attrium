<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import type { Component } from 'vue'
import { computed, ref } from 'vue'
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from '@/components/ui/sidebar'
import { useServerData } from '@/composables/useServerData'

interface NavChild {
	title: string
	url: string
	slug?: string
	badge?: string
}

interface NavItem {
	title: string
	url: string
	icon?: Component
	badge?: string
	slug?: string
	children?: NavChild[]
}

const props = defineProps<{
	items: NavItem[]
}>()

const { parentFile, submenuFile } = useServerData()

/**
 * Determine the active parent — the top-level menu item whose URL or child's
 * URL matches the current page. That parent's submenu is always expanded.
 *
 * WordPress resolves the current item itself (menu-header.php) and hands it to
 * us as `parent-file`/`submenu-file` — those slugs are matched exactly, which
 * is what keeps e.g. a `edit.php?post_type=...` submenu (Bricks Templates)
 * from ever matching a plain `edit.php` page (Posts). The URL matching below
 * is only a fallback for pages WordPress itself cannot place.
 */
function urlsMatch(a: string, b: string): boolean {
	const ua = new URL(a, window.location.origin)
	const ub = new URL(b, window.location.origin)
	ua.hash = ''
	ub.hash = ''
	return (
		ua.pathname.replace(/\/+$/, '') === ub.pathname.replace(/\/+$/, '') &&
		ua.searchParams.get('page') === ub.searchParams.get('page')
	)
}

const currentUrl = computed(() => window.location.href)

const activeParent = computed<string | null>(() => {
	// Authoritative: WordPress's own parent slug, matched against the menu
	// item slug emitted by Menu.php (both are the raw $item[2] / $menu_slug).
	if (parentFile) {
		const match = props.items.find((item) => item.slug === parentFile)
		if (match) return match.title
	}

	// Fallback: match by URL for pages WordPress didn't resolve a parent for.
	const cur = currentUrl.value
	for (const item of props.items) {
		if (!item.children?.length) continue
		if (item.url && urlsMatch(cur, item.url)) return item.title
		for (const child of item.children) {
			if (child.url && urlsMatch(cur, child.url)) return item.title
		}
	}
	return null
})

/**
 * Whether a submenu item is the current page. Prefer WordPress's own
 * `submenu-file` slug (exact match against the child slug); fall back to URL
 * matching only when WordPress reported no submenu (top-level pages).
 */
function isChildActive(child: NavChild): boolean {
	if (submenuFile) return child.slug === submenuFile
	return urlsMatch(currentUrl.value, child.url)
}

/**
 * Whether a standalone top-level item (no submenu) is the current page. Matches
 * WordPress's parent-file/submenu-file slugs only — never falls back to URL
 * matching, so footer links (which carry no slug) stay unhighlighted.
 */
function isItemActive(item: NavItem): boolean {
	if (!item.slug) return false
	return item.slug === parentFile || item.slug === submenuFile
}

/**
 * Accordion-style manual toggle, independent of the active parent.
 * - Clicking a non-active item opens it and closes any other manual open.
 * - Clicking it again closes it.
 * - Clicking the active parent does nothing (it's always open).
 */
const manualOpen = ref<string | null>(null)

function toggle(title: string) {
	if (title === activeParent.value) return
	manualOpen.value = manualOpen.value === title ? null : title
}

function isOpen(title: string): boolean {
	return title === activeParent.value || manualOpen.value === title
}

function titleClass(item: NavItem): string {
	return item.title === activeParent.value ? 'font-semibold' : 'font-medium'
}
</script>

<template>
	<SidebarGroup>
		<SidebarGroupContent class="flex flex-col gap-2">
			<SidebarMenu>
				<SidebarMenuItem v-for="item in items" :key="item.title">
					<!--
            Top-level items with a submenu expand on click.
            Items without children link directly so standalone admin pages
            still navigate (full page load -> embedded WP page loads).
          -->
					<SidebarMenuButton
						v-if="item.children?.length"
						:tooltip="item.title"
						:is-active="item.title === activeParent"
						@click="toggle(item.title)"
					>
						<component :is="item.icon" v-if="item.icon" />
						<span class="ml-3" :class="titleClass(item)">{{ item.title }}</span>
						<SidebarMenuBadge
							v-if="item.badge"
							class="static top-auto right-auto ml-auto h-4 min-w-4 bg-sidebar-primary text-sidebar-primary-foreground"
						>
							{{ item.badge }}
						</SidebarMenuBadge>
						<ChevronRight
							class="h-4 w-4 transition-transform duration-200"
							:class="[item.badge ? 'ml-1' : 'ml-auto', { 'rotate-90': isOpen(item.title) }]"
						/>
					</SidebarMenuButton>
					<SidebarMenuButton
						v-else
						as-child
						:tooltip="item.title"
						:is-active="isItemActive(item)"
					>
						<a :href="item.url || '#'">
							<component :is="item.icon" v-if="item.icon" />
							<span class="ml-3" :class="titleClass(item)">
								{{ item.title }}
							</span>
							<SidebarMenuBadge
								v-if="item.badge"
								class="static top-auto right-auto ml-auto h-4 min-w-4 bg-sidebar-primary text-sidebar-primary-foreground"
							>
								{{ item.badge }}
							</SidebarMenuBadge>
						</a>
					</SidebarMenuButton>
					<div
						v-if="item.children?.length"
						class="submenu-wrapper"
						:class="{ 'submenu-open': isOpen(item.title) }"
					>
						<SidebarMenuSub>
							<SidebarMenuSubItem
								v-for="child in item.children"
								:key="child.title"
							>
								<SidebarMenuSubButton
									as-child
									:is-active="isChildActive(child)"
									:class="isChildActive(child) ? 'data-active:bg-transparent! data-active:text-sidebar-accent-foreground!' : ''"
								>
									<a :href="child.url || '#'">
										<span>{{ child.title }}</span>
										<SidebarMenuBadge
											v-if="child.badge"
											class="static top-auto right-auto ml-auto h-4 min-w-4 bg-sidebar-primary text-sidebar-primary-foreground"
										>
											{{ child.badge }}
										</SidebarMenuBadge>
									</a>
								</SidebarMenuSubButton>
							</SidebarMenuSubItem>
						</SidebarMenuSub>
					</div>
				</SidebarMenuItem>
			</SidebarMenu>
		</SidebarGroupContent>
	</SidebarGroup>
</template>
