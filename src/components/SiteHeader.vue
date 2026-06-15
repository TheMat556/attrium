<script setup lang="ts">
import { Search, ExternalLink, Plus, Sun, Moon } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useTheme } from '@/composables/useTheme'

const { isDark, toggle } = useTheme()
</script>

<template>
  <header class="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
    <div class="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
      <SidebarTrigger class="-ml-1" />
      <Separator
        orientation="vertical"
        class="mx-2 data-[orientation=vertical]:h-4"
      />
      <Button variant="ghost" size="icon-sm">
        <Plus />
      </Button>

      <div class="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" @click="toggle">
          <Sun v-if="!isDark()" />
          <Moon v-else />
        </Button>
        <Separator
          orientation="vertical"
          class="mx-1 data-[orientation=vertical]:h-4"
        />
        <Button variant="ghost" size="icon-sm">
          <Search />
        </Button>
        <Button variant="ghost" size="icon-sm">
          <ExternalLink />
        </Button>
      </div>
    </div>
  </header>
</template>
