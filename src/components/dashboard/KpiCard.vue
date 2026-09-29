<script setup lang="ts">
import { ArrowDownRight, ArrowUpRight } from '@lucide/vue'
import type { Component } from 'vue'
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import type { Severity } from '@/composables/useDashboard'
import { cn } from '@/lib/utils'

type KpiState = 'configured' | 'unconfigured' | 'issue'

const props = withDefaults(
	defineProps<{
		title: string
		value?: string
		description?: string
		severity?: Severity
		state?: KpiState
		trend?: number | null
		trendLabel?: string
		icon?: Component
		stateIcon?: Component
		actionLabel?: string
		actionUrl?: string
		class?: string
	}>(),
	{
		value: '',
		description: '',
		severity: 'healthy',
		state: 'configured',
		trend: null,
		trendLabel: '',
		icon: undefined,
		stateIcon: undefined,
		actionLabel: '',
		actionUrl: '',
		class: '',
	},
)

const trendIsUp = computed(() => (props.trend ?? 0) >= 0)
const trendText = computed(() => {
	if (props.trend === null) return ''
	const sign = props.trend > 0 ? '+' : ''
	return `${sign}${props.trend}%`
})

const stateClass = computed(() => {
	if (props.state === 'unconfigured') return 'text-muted-foreground'
	if (props.severity === 'critical') return 'text-critical'
	if (props.severity === 'warning') return 'text-warning'
	return 'text-foreground'
})
</script>

<template>
	<Card :class="cn('@container/kpi h-36', props.class)">
		<CardHeader class="pb-0">
			<CardTitle
				class="text-muted-foreground text-sm font-medium flex items-center gap-2"
			>
				<component :is="icon" v-if="icon" class="size-4" />
				{{ title }}
			</CardTitle>
		</CardHeader>
		<CardContent class="flex min-h-0 flex-1 flex-col gap-1">
			<template v-if="state === 'unconfigured' || state === 'issue'">
				<div
					class="flex flex-1 flex-col items-center justify-center gap-1 text-center"
				>
					<component
						:is="stateIcon"
						v-if="stateIcon"
						:class="cn('size-6 shrink-0', stateClass)"
						aria-hidden="true"
					/>
					<CardDescription :class="cn('leading-5', stateClass)">
						{{ description }}
					</CardDescription>
					<Button
						v-if="actionLabel && actionUrl"
						variant="link"
						size="xs"
						as="a"
						:href="actionUrl"
						class="text-muted-foreground hover:text-foreground h-auto p-0"
					>
						{{ actionLabel }} →
					</Button>
				</div>
			</template>

			<template v-else>
				<div class="flex items-end justify-between gap-2">
					<span
						:class="cn('text-2xl font-semibold tracking-tight tabular-nums @lg/kpi:text-3xl', stateClass)"
					>
						{{ value }}
					</span>
					<Badge v-if="trend !== null" variant="outline" class="gap-0.5">
						<component
							:is="trendIsUp ? ArrowUpRight : ArrowDownRight"
							class="size-3"
						/>
						{{ trendText }}
					</Badge>
				</div>
				<p v-if="description" class="text-muted-foreground text-sm leading-5">
					{{ description }}
				</p>
				<p v-if="trendLabel" class="text-muted-foreground text-xs leading-5">
					{{ trendLabel }}
				</p>
			</template>
		</CardContent>
	</Card>
</template>
