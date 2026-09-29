<script setup lang="ts">
import { ArrowRight, CircleCheck } from '@lucide/vue'
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import type {
	HealthCategory,
	SiteHealthSection,
} from '@/composables/useDashboard'
import SeverityBadge from './SeverityBadge.vue'

const props = defineProps<{
	siteHealth: SiteHealthSection
}>()

function problems(category: HealthCategory) {
	return category.items.filter((item) => item.severity !== 'healthy')
}
</script>

<template>
	<Card>
		<CardHeader>
			<CardTitle>Site health</CardTitle>
			<CardDescription>
				{{ props.siteHealth.issueCount === 0
						? 'Everything WordPress checks is in good shape.'
						: `${props.siteHealth.issueCount} item${props.siteHealth.issueCount === 1 ? '' : 's'} could use a look.` }}
			</CardDescription>
			<CardAction>
				<SeverityBadge
					:severity="props.siteHealth.severity"
					:label="
						props.siteHealth.issueCount === 0
							? 'All good'
							: `${props.siteHealth.issueCount} to review`
					"
				/>
			</CardAction>
		</CardHeader>
		<CardContent class="flex flex-col gap-5">
			<section
				v-for="category in props.siteHealth.categories"
				:key="category.id"
				class="flex flex-col gap-2"
			>
				<h3 class="text-sm font-semibold">{{ category.label }}</h3>

				<div
					v-if="category.issueCount === 0"
					class="text-success flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center text-sm"
				>
					<CircleCheck class="size-6 shrink-0" />
					<span>No issues found.</span>
				</div>

				<ul v-else class="flex flex-col divide-y">
					<li
						v-for="item in problems(category)"
						:key="item.id"
						class="flex flex-col gap-1 py-2"
					>
						<div class="flex items-center justify-between gap-3">
							<span class="text-sm font-medium">{{ item.label }}</span>
							<SeverityBadge :severity="item.severity" />
						</div>
						<p v-if="item.description" class="text-muted-foreground text-sm">
							{{ item.description }}
						</p>
						<a
							v-if="item.actionUrl"
							:href="item.actionUrl"
							class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
						>
							{{ item.actionLabel || 'Fix this' }}
							<ArrowRight class="size-3" />
						</a>
					</li>
				</ul>
			</section>
		</CardContent>
	</Card>
</template>
