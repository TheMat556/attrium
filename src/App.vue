<script setup lang="ts">
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Plus, ExternalLink, Search } from '@lucide/vue'
import NavUser from '@/components/NavUser.vue'
</script>

<template>
  <div class="flex min-h-dvh w-full">
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div class="flex h-14 items-center gap-2 px-4">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              A
            </div>
            <span class="font-semibold text-lg">Attrium</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <!-- Sidebar items go here -->
        </SidebarContent>
        <SidebarFooter>
          <NavUser />
        </SidebarFooter>
      </Sidebar>
      <div class="flex flex-1 flex-col">
        <header class="bg-card sticky top-0 z-50 flex h-14 items-center justify-between gap-6 border-b px-4 py-2 sm:px-6 [&_svg]:size-5!">
          <div class="flex items-center gap-1">
            <SidebarTrigger />
            <Separator orientation="vertical" class="mx-2 h-6" />
            <Button variant="ghost" size="icon-sm">
              <Plus />
            </Button>
          </div>
          <div class="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm">
              <Search />
            </Button>
            <Button variant="ghost" size="icon-sm">
              <ExternalLink />
            </Button>
          </div>
        </header>
        <main class="size-full flex-1 px-4 py-6 sm:px-6">
          <router-view />
        </main>
      </div>
    </SidebarProvider>
  </div>
</template>
