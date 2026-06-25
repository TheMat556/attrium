<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import type { Component } from 'vue'
import { ref } from 'vue'
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

defineProps<{
	items: NavItem[]
}>()

const openMap = ref<Record<string, boolean>>({})

function toggle(title: string) {
	openMap.value[title] = !openMap.value[title]
}

function isOpen(title: string) {
	return !!openMap.value[title]
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
            @click="toggle(item.title)"
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
              class="h-4 w-4 transition-transform duration-200"
              :class="[item.badge ? 'ml-1' : 'ml-auto', { 'rotate-90': isOpen(item.title) }]"
            />
          </SidebarMenuButton>
          <SidebarMenuButton
            v-else
            asChild
            :tooltip="item.title"
          >
            <a :href="item.url">
              <component :is="item.icon" v-if="item.icon" />
              <span>{{ item.title }}</span>
              <SidebarMenuBadge
                v-if="item.badge"
                class="static top-auto right-auto ml-auto h-4 min-w-4 bg-sidebar-primary text-sidebar-primary-foreground"
              >
                {{ item.badge }}
              </SidebarMenuBadge>
            </a>
          </SidebarMenuButton>
          <SidebarMenuSub v-if="item.children?.length" v-show="isOpen(item.title)">
            <SidebarMenuSubItem v-for="child in item.children" :key="child.title">
              <SidebarMenuSubButton asChild>
                <a :href="child.url">
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
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
</template>
