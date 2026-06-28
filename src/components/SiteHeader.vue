<script setup lang="ts">
import {
	ExternalLink,
	File,
	FileText,
	Moon,
	Plus,
	Search,
	Sun,
} from '@lucide/vue'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useServerData } from '@/composables/useServerData'
import { isDark, toggle } from '@/composables/useTheme'

const { adminUrl, siteUrl } = useServerData()

function newPost() {
	window.location.href = `${adminUrl}post-new.php`
}

function newPage() {
	window.location.href = `${adminUrl}post-new.php?post_type=page`
}

function openFrontend() {
	window.open(siteUrl, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <header class="flex h-(--header-height) shrink-0 items-center gap-2 bg-transparent transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
    <div class="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
      <SidebarTrigger class="-ml-1" />
      <Separator
        orientation="vertical"
        class="data-[orientation=vertical]:h-6"
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <Plus />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" :side-offset="4">
          <DropdownMenuItem @click="newPost">
            <FileText />
            New Post
          </DropdownMenuItem>
          <DropdownMenuItem @click="newPage">
            <File />
            New Page
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div class="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" @click="toggle">
          <Sun v-if="isDark" />
          <Moon v-else />
        </Button>
        <Separator
          orientation="vertical"
          class="mx-1 data-[orientation=vertical]:h-6"
        />
        <Button variant="ghost" size="icon-sm">
          <Search />
        </Button>
        <Button variant="ghost" size="icon-sm" @click="openFrontend">
          <ExternalLink />
        </Button>
      </div>
    </div>
  </header>
</template>
