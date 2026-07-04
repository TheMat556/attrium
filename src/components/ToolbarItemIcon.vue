<script setup lang="ts">
import type { ToolbarIcon } from '@/composables/useToolbar'

defineProps<{ icon: ToolbarIcon | null }>()
</script>

<template>
	<span
		v-if="icon?.kind === 'html'"
		class="size-4 flex items-center justify-center"
		v-html="icon.html"
	/>
	<span
		v-else-if="icon?.kind === 'css' && icon.backgroundImage"
		class="size-4"
		:style="{
			backgroundImage: icon.backgroundImage,
			backgroundSize: 'contain',
			backgroundRepeat: 'no-repeat',
			backgroundPosition: 'center',
		}"
	/>
	<span
		v-else-if="icon?.kind === 'css'"
		class="ab-icon"
		:style="{ fontFamily: icon.fontFamily }"
	>
		{{ icon.content }}
	</span>
	<span v-else class="size-4 rounded bg-muted-foreground/20" />
</template>
