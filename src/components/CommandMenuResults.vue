<script setup lang="ts">
import { CommandGroup, CommandItem, useCommand } from '@/components/ui/command'
import type { HistoryInput } from '@/composables/usePaletteHistory'
import { useServerData } from '@/composables/useServerData'
import { getIcon } from '@/lib/iconMap'

// useCommand resolves only inside <Command> — this component must be rendered
// within <CommandList>. filterState.search is the live palette query; the menu
// is hidden entirely until the user types so an empty palette shows only the
// history + static action groups.
const { filterState } = useCommand()
const { menu } = useServerData()

const emit = defineEmits<{ select: [entry: HistoryInput] }>()

// Top-level items with submenus get their own group; childless ones fold into a
// single "Go to" group so standalone pages don't each become a one-item group.
const menuWithChildren = menu.filter((item) => item.children.length > 0)
const menuChildless = menu.filter((item) => item.children.length === 0)

function entry(label: string, url: string, icon: string): HistoryInput {
	return { id: url, label, url, icon }
}
</script>

<template>
  <template v-if="filterState.search">
    <CommandGroup v-if="menuChildless.length" heading="Go to">
      <CommandItem
        v-for="item in menuChildless"
        :key="item.slug"
        :value="item.title"
        @select="emit('select', entry(item.title, item.url, item.icon))"
      >
        <component :is="getIcon(item.icon)" />
        {{ item.title }}
      </CommandItem>
    </CommandGroup>

    <CommandGroup
      v-for="item in menuWithChildren"
      :key="item.slug"
      :heading="item.title"
    >
      <CommandItem
        v-for="child in item.children"
        :key="child.url"
        :value="`${item.title} ${child.title}`"
        @select="emit('select', entry(`${item.title} › ${child.title}`, child.url, item.icon))"
      >
        <component :is="getIcon(item.icon)" />
        {{ child.title }}
      </CommandItem>
    </CommandGroup>
  </template>
</template>
