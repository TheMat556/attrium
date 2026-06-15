<script setup lang="ts">
import {
  LayoutDashboard,
  List,
  BarChart3,
  FolderKanban,
  Users,
  Database,
  FileText,
  Settings,
  LifeBuoy,
  Search,
  FileAxis3d,
} from '@lucide/vue'
import NavMain from '@/components/NavMain.vue'
import NavDocuments from '@/components/NavDocuments.vue'
import NavSecondary from '@/components/NavSecondary.vue'
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

const navMain = [
  { title: 'Dashboard', url: '#', icon: LayoutDashboard },
  { title: 'Lifecycle', url: '#', icon: List },
  { title: 'Analytics', url: '#', icon: BarChart3 },
  { title: 'Projects', url: '#', icon: FolderKanban },
  { title: 'Team', url: '#', icon: Users },
]

const documents = [
  { name: 'Data Library', url: '#', icon: Database },
  { name: 'Reports', url: '#', icon: FileText },
  { name: 'Word Assistant', url: '#', icon: FileAxis3d },
]

const navSecondary = [
  { title: 'Settings', url: '#', icon: Settings },
  { title: 'Get Help', url: '#', icon: LifeBuoy },
  { title: 'Search', url: '#', icon: Search },
]
</script>

<template>
  <Sidebar collapsible="offcanvas" variant="inset">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            class="data-[slot=sidebar-menu-button]:p-1.5!"
          >
            <a href="#">
              <div class="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
                A
              </div>
              <span class="text-base font-semibold">Attrium</span>
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
    <SidebarContent>
      <NavMain :items="navMain" />
      <NavDocuments :items="documents" />
      <NavSecondary :items="navSecondary" class="mt-auto" />
    </SidebarContent>
    <SidebarFooter>
      <NavUser />
    </SidebarFooter>
  </Sidebar>
</template>
