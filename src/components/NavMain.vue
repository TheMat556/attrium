<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import type { Component } from 'vue'
import { ref } from 'vue'
import { useRoute } from 'vue-router'
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
import { useIframeNavigation } from '@/composables/useIframeNavigation'

interface NavChild {
	title: string
	url: string
	badge?: string
}

interface NavItem {
	title: string
	url: string
	icon?: Component
	badge?: string
	children?: NavChild[]
}

const props = defineProps<{
	items: NavItem[]
}>()

const route = useRoute()
const { navigateTo, extractRelativePath } = useIframeNavigation()

/** True for links pointing to a different origin than the current site. */
function isExternalLink(url: string): boolean {
	if (!url.startsWith('http')) return false
	try {
		return new URL(url).origin !== window.location.origin
	} catch {
		return false
	}
}

const openMap = ref<Record<string, boolean>>({})

function toggle(title: string) {
	openMap.value[title] = !openMap.value[title]
}

function isOpen(title: string) {
	return !!openMap.value[title]
}

function handleClick(url: string, children?: NavChild[]) {
	if (children && children.length > 0) {
		// Toggle submenu
		const item = props.items.find((i) => i.url === url)
		if (item) toggle(item.title)
		return
	}

	// External links open in new tab
	if (isExternalLink(url)) {
		window.open(url, '_blank', 'noopener,noreferrer')
		return
	}

	navigateTo(url)
}

function handleChildClick(url: string) {
	// External links open in new tab
	if (isExternalLink(url)) {
		window.open(url, '_blank', 'noopener,noreferrer')
		return
	}
	navigateTo(url)
}

/** Check if a URL matches the current route */
function isActive(url: string): boolean {
	if (route.name !== 'wp-page') return false

	const currentPath = route.query.path as string | undefined
	if (!currentPath) return false

	// Compare normalized relative admin paths for an exact match.
	return extractRelativePath(url) === currentPath
}
</script>

<template>
  <SidebarGroup>
    <SidebarGroupContent class="flex flex-col gap-2">
      <SidebarMenu>
        <SidebarMenuItem v-for="item in items" :key="item.title">
          <SidebarMenuButton
            :tooltip="item.title"
            :data-active="isActive(item.url) ? 'true' : undefined"
            @click="handleClick(item.url, item.children)"
          >
            <component :is="item.icon" v-if="item.icon" />
            <span>{{ item.title }}</span>
            <SidebarMenuBadge
              v-if="item.badge"
              class="static top-auto right-auto ml-auto h-4 min-w-4 bg-sidebar-primary text-sidebar-primary-foreground"
            >
              {{ item.badge }}
            </SidebarMenuBadge>
            <ChevronRight
              v-if="item.children?.length"
              class="h-4 w-4 transition-transform duration-200"
              :class="[item.badge ? 'ml-1' : 'ml-auto', { 'rotate-90': isOpen(item.title) }]"
            />
          </SidebarMenuButton>
          <SidebarMenuSub v-if="item.children?.length" v-show="isOpen(item.title)">
            <SidebarMenuSubItem v-for="child in item.children" :key="child.title">
              <SidebarMenuSubButton
                :data-active="isActive(child.url) ? 'true' : undefined"
                @click="handleChildClick(child.url)"
              >
                <span>{{ child.title }}</span>
                <SidebarMenuBadge
                  v-if="child.badge"
                  class="static top-auto right-auto ml-auto h-4 min-w-4 bg-sidebar-primary text-sidebar-primary-foreground"
                >
                  {{ child.badge }}
                </SidebarMenuBadge>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          </SidebarMenuSub>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
</template>
