<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import type { Severity } from '@/composables/useDashboard'

const props = withDefaults(
	defineProps<{
		severity: Severity
		label?: string
	}>(),
	{ label: '' },
)

const text = computed(() => {
	if (props.label) return props.label

	if (props.severity === 'critical') return 'Needs attention'
	if (props.severity === 'warning') return 'Check'
	return 'Healthy'
})

const token = computed(() => {
	if (props.severity === 'critical') return 'var(--color-critical)'
	if (props.severity === 'warning') return 'var(--color-warning)'
	return 'var(--color-success)'
})
</script>

<template>
	<Badge
		variant="outline"
		class="border-transparent"
		:style="{
			color: token,
			backgroundColor: `color-mix(in oklab, ${token} 12%, transparent)`,
		}"
	>
		<span
			class="size-1.5 rounded-full"
			:style="{ backgroundColor: token }"
			aria-hidden="true"
		/>
		{{ text }}
	</Badge>
</template>
