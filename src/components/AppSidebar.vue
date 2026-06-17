<script setup lang="ts">
import { LifeBuoy, Settings } from '@lucide/vue'
import { computed } from 'vue'
import NavMain from '@/components/NavMain.vue'
import NavUser from '@/components/NavUser.vue'
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useServerData } from '@/composables/useServerData'
import { getIcon } from '@/lib/iconMap'

const { menu, adminUrl } = useServerData()

const navMain = computed(() => {
	return menu.map((item) => ({
		title: item.title,
		url: item.url,
		icon: getIcon(item.icon),
		badge: item.badge,
		children: item.children.map((child) => ({
			title: child.title,
			url: child.url,
			badge: child.badge,
		})),
	}))
})

const footerItems = computed(() => [
	{ title: 'Settings', url: `${adminUrl}options-general.php`, icon: Settings },
	{ title: 'Get Help', url: 'https://wordpress.org/support', icon: LifeBuoy },
])
</script>

<template>
  <Sidebar collapsible="icon" variant="inset">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            class="data-[slot=sidebar-menu-button]:p-1.5!"
          >
            <a href="#">
              <div
                class="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold"
              >
                A
              </div>
              <span class="text-base font-semibold group-data-[collapsible=icon]:hidden"
                >Attrium</span
              >
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
    <SidebarContent>
      <NavMain :items="navMain" />
    </SidebarContent>
    <SidebarFooter>
      <NavMain :items="footerItems" />
      <NavUser />
    </SidebarFooter>
  </Sidebar>
</template>
