<script setup lang="ts">
import {
	DropdownMenuItem,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import type { ToolbarChild } from '@/composables/useToolbar'
import { handleToolbarClick } from '@/composables/useToolbar'

defineProps<{ items: ToolbarChild[] }>()
</script>

<template>
	<template v-for="child in items" :key="child.id">
		<DropdownMenuItem
			v-if="!child.children.length"
			@click="handleToolbarClick(child)"
		>
			{{ child.name }}
		</DropdownMenuItem>
		<DropdownMenuSub v-else>
			<DropdownMenuSubTrigger>
				{{ child.name }}
			</DropdownMenuSubTrigger>
			<DropdownMenuSubContent>
				<ToolbarSubmenu :items="child.children" />
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	</template>
</template>
