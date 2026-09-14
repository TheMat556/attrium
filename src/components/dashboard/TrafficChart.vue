<script setup lang="ts">
import { VisArea, VisAxis, VisXYContainer } from '@unovis/vue'
import { computed } from 'vue'
import {
	type ChartConfig,
	ChartContainer,
	ChartCrosshair,
	ChartTooltip,
	ChartTooltipContent,
	componentToString,
} from '@/components/ui/chart'
import type { TrafficPoint } from '@/composables/useDashboard'

const props = defineProps<{
	points: TrafficPoint[]
}>()

const chartConfig = {
	users: { label: 'Visitors', color: 'var(--attrium-chart-1)' },
	views: { label: 'Page views', color: 'var(--attrium-chart-3)' },
} satisfies ChartConfig

const x = (d: TrafficPoint) => new Date(d.date)
const y = (d: TrafficPoint) => d.users

const formatTick = (value: number | Date): string => {
	const date = value instanceof Date ? value : new Date(value)
	if (Number.isNaN(date.getTime())) return ''
	return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const tooltipTemplate = computed(() =>
	componentToString(chartConfig, ChartTooltipContent, {
		indicator: 'line',
		labelFormatter: formatTick,
	}),
)
</script>

<template>
	<ChartContainer :config="chartConfig" class="h-60 w-full">
		<VisXYContainer
			:data="points"
			:margin="{ top: 8, right: 8, bottom: 0, left: 0 }"
		>
			<VisArea :x="x" :y="y" color="var(--color-users)" :opacity="0.18" />
			<VisAxis
				type="x"
				:x="x"
				:tick-format="formatTick"
				:grid-line="false"
				:domain-line="false"
			/>
			<VisAxis
				type="y"
				:grid-line="true"
				:domain-line="false"
				:tick-format="(value: number) => value.toLocaleString()"
			/>
			<ChartCrosshair
				v-if="tooltipTemplate"
				:template="tooltipTemplate"
				color="var(--color-users)"
			/>
			<ChartTooltip />
		</VisXYContainer>
	</ChartContainer>
</template>
