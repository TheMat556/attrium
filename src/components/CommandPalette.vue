<script setup lang="ts">
import { ArrowDown, ArrowUp, CornerDownLeft, Moon, Sun } from '@lucide/vue'
import { computed } from 'vue'
import CommandMediaResults from '@/components/CommandMediaResults.vue'
import CommandMenuResults from '@/components/CommandMenuResults.vue'
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from '@/components/ui/command'
import {
	type HistoryInput,
	usePaletteHistory,
} from '@/composables/usePaletteHistory'
import { useServerData } from '@/composables/useServerData'
import { isDark, toggle } from '@/composables/useTheme'
import { useWpActions } from '@/composables/useWpActions'
import { getIcon } from '@/lib/iconMap'

const open = defineModel<boolean>('open', { default: false })

const { canCreatePosts, canCreatePages } = useServerData()
const { adminPath, viewSite } = useWpActions()
const { record, recent, frequent } = usePaletteHistory()

// Static actions modelled as history-shaped entries so they navigate, record,
// and render icons through the same path as menu/media rows. Dashicon strings
// resolve to Lucide components via getIcon at render time.
const newPostEntry: HistoryInput = {
	id: adminPath('post-new.php'),
	label: 'New Post',
	url: adminPath('post-new.php'),
	icon: 'dashicons-admin-post',
}
const newPageEntry: HistoryInput = {
	id: adminPath('post-new.php?post_type=page'),
	label: 'New Page',
	url: adminPath('post-new.php?post_type=page'),
	icon: 'dashicons-admin-page',
}
const dashboardEntry: HistoryInput = {
	id: adminPath('index.php'),
	label: 'Go to Dashboard',
	url: adminPath('index.php'),
	icon: 'dashicons-dashboard',
}

// Each selection closes the palette before it runs so the dialog never lingers
// over a full-page navigation.
function close() {
	open.value = false
}

// Unified selection path: record the pick (so it feeds Recently/Frequently),
// close the palette, then navigate via full page load (Attrium convention —
// URLs are already absolute admin URLs).
function select(entry: HistoryInput) {
	record(entry)
	close()
	window.location.href = entry.url
}

// View Site opens an external tab — record it for history, but navigation is
// handled by useWpActions (new tab, not a same-page load).
function selectViewSite() {
	close()
	viewSite()
}

const themeLabel = computed(() =>
	isDark.value ? 'Switch to light theme' : 'Switch to dark theme',
)

function toggleTheme() {
	close()
	toggle()
}
</script>

<template>
  <CommandDialog
    v-model:open="open"
    class="p-2 [&_[data-slot=command-group-heading]]:mt-3 [&_[data-slot=command-group-heading]]:mb-1"
  >
    <CommandInput placeholder="Type a command or search..." />
    <CommandList class="px-1">
      <CommandEmpty>No results found.</CommandEmpty>

      <CommandGroup v-if="recent.length" heading="Recently used">
        <CommandItem
          v-for="entry in recent"
          :key="entry.id"
          :value="entry.label"
          @select="select(entry)"
        >
          <component :is="getIcon(entry.icon)" v-if="entry.icon" />
          {{ entry.label }}
        </CommandItem>
      </CommandGroup>

      <CommandGroup v-if="frequent.length" heading="Frequently used">
        <CommandItem
          v-for="entry in frequent"
          :key="entry.id"
          :value="entry.label"
          @select="select(entry)"
        >
          <component :is="getIcon(entry.icon)" v-if="entry.icon" />
          {{ entry.label }}
        </CommandItem>
      </CommandGroup>

      <CommandGroup heading="Create">
        <CommandItem
          v-if="canCreatePosts"
          value="new post"
          @select="select(newPostEntry)"
        >
          <component :is="getIcon(newPostEntry.icon)" />
          New Post
        </CommandItem>
        <CommandItem
          v-if="canCreatePages"
          value="new page"
          @select="select(newPageEntry)"
        >
          <component :is="getIcon(newPageEntry.icon)" />
          New Page
        </CommandItem>
      </CommandGroup>

      <CommandGroup heading="Navigate">
        <CommandItem value="dashboard" @select="select(dashboardEntry)">
          <component :is="getIcon(dashboardEntry.icon)" />
          Go to Dashboard
        </CommandItem>
        <CommandItem value="view site" @select="selectViewSite">
          <component :is="getIcon('dashicons-welcome-view-site')" />
          View Site
        </CommandItem>
      </CommandGroup>

      <CommandGroup heading="Preferences">
        <CommandItem value="toggle theme" @select="toggleTheme">
          <Sun v-if="isDark" />
          <Moon v-else />
          {{ themeLabel }}
        </CommandItem>
      </CommandGroup>

      <CommandMenuResults @select="select" />
      <CommandMediaResults @select="select" />
    </CommandList>
    <div
      class="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-2 pt-3 text-xs"
    >
      <span class="flex items-center gap-1.5">
        <kbd class="bg-muted flex items-center gap-0.5 rounded px-1 py-1 text-xs">
          <ArrowUp class="size-3" />
          <ArrowDown class="size-3" />
        </kbd>
        to navigate
      </span>
      <span class="flex items-center gap-1.5">
        <kbd class="bg-muted rounded px-1.5 py-0.5 text-xs">Esc</kbd>
        to close
      </span>
      <span class="flex items-center gap-1.5">
        <kbd class="bg-muted flex items-center rounded px-1 py-1 text-xs">
          <CornerDownLeft class="size-3" />
        </kbd>
        to select
      </span>
    </div>
  </CommandDialog>
</template>
