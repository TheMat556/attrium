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
import { onBeforeUnmount, onMounted, ref } from 'vue'
import CommandPalette from '@/components/CommandPalette.vue'
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
import { useWpActions } from '@/composables/useWpActions'

const { canCreatePosts, canCreatePages } = useServerData()
const { newPost, newPage, viewSite } = useWpActions()

const canCreateAny = canCreatePosts || canCreatePages

const paletteOpen = ref(false)

// ⌘K / Ctrl+K toggles the command palette, matching the convention users
// expect from this kind of overlay.
function onKeydown(e: KeyboardEvent) {
	if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
		e.preventDefault()
		paletteOpen.value = !paletteOpen.value
	}
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <header class="flex h-(--header-height) shrink-0 items-center gap-2 bg-transparent transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
    <div class="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
      <SidebarTrigger class="-ml-1" />
      <Separator
        orientation="vertical"
        class="data-[orientation=vertical]:h-6"
      />
      <DropdownMenu v-if="canCreateAny">
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <Plus />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" :side-offset="4">
          <DropdownMenuItem v-if="canCreatePosts" @click="newPost">
            <FileText />
            New Post
          </DropdownMenuItem>
          <DropdownMenuItem v-if="canCreatePages" @click="newPage">
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
        <Button variant="ghost" size="icon-sm" @click="paletteOpen = true">
          <Search />
        </Button>
        <Button variant="ghost" size="icon-sm" @click="viewSite">
          <ExternalLink />
        </Button>
      </div>
    </div>
    <CommandPalette v-model:open="paletteOpen" />
  </header>
</template>
