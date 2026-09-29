<script setup lang="ts">
import { ArrowRight, CircleCheck, ShieldAlert } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import type {
	UpdateItem,
	UpdatesSection as UpdatesData,
} from '@/composables/useDashboard'
import SeverityBadge from './SeverityBadge.vue'

const props = defineProps<{
	updates: UpdatesData
}>()

function stateLabel(item: UpdateItem): string {
	if (item.current) return `${item.current} → ${item.new}`
	return item.new
}
</script>

<template>
	<Card>
		<CardHeader>
			<CardTitle>Updates</CardTitle>
			<CardDescription>
				{{ props.updates.total === 0
						? 'WordPress, plugins and themes are all up to date.'
						: `${props.updates.total} update${props.updates.total === 1 ? '' : 's'} available.` }}
			</CardDescription>
			<CardAction>
				<SeverityBadge
					:severity="props.updates.severity"
					:label="
						props.updates.total === 0
							? 'Current'
							: `${props.updates.total} to do`
					"
				/>
			</CardAction>
		</CardHeader>
		<CardContent class="flex flex-col gap-5">
			<div
				v-if="props.updates.total === 0"
				class="text-success flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center text-sm"
			>
				<CircleCheck class="size-6 shrink-0" />
				<span>Nothing to update, everything's current.</span>
			</div>

			<template v-else>
				<section
					v-if="props.updates.security.length"
					class="flex flex-col gap-2"
				>
					<h3
						class="text-critical flex items-center gap-2 text-sm font-semibold"
					>
						<ShieldAlert class="size-4" />
						Security updates
						<span class="text-muted-foreground font-normal">
							update immediately
						</span>
					</h3>
					<ul class="flex flex-col divide-y">
						<li
							v-for="item in props.updates.security"
							:key="`${item.type}-${item.name}`"
							class="flex items-center justify-between gap-3 py-2"
						>
							<div class="flex min-w-0 flex-col">
								<span class="truncate text-sm font-medium">
									{{ item.name }}
								</span>
								<span class="text-muted-foreground font-mono text-xs">
									{{ stateLabel(item) }}
								</span>
							</div>
							<Badge variant="destructive" class="shrink-0">
								{{ item.type === 'core' ? 'WordPress' : item.type }}
							</Badge>
						</li>
					</ul>
				</section>

				<section
					v-if="props.updates.regular.length"
					class="flex flex-col gap-2"
				>
					<h3 class="text-warning text-sm font-semibold">Regular updates</h3>
					<ul class="flex flex-col divide-y">
						<li
							v-for="item in props.updates.regular"
							:key="`${item.type}-${item.name}`"
							class="flex items-center justify-between gap-3 py-2"
						>
							<div class="flex min-w-0 flex-col">
								<span class="truncate text-sm font-medium">
									{{ item.name }}
								</span>
								<span class="text-muted-foreground font-mono text-xs">
									{{ stateLabel(item) }}
								</span>
							</div>
							<Badge variant="secondary" class="shrink-0 capitalize">
								{{ item.type }}
							</Badge>
						</li>
					</ul>
				</section>
			</template>

			<a
				v-if="props.updates.total > 0"
				:href="props.updates.security[0]?.actionUrl || props.updates.regular[0]?.actionUrl"
				class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
			>
				Open the updates screen
				<ArrowRight class="size-3.5" />
			</a>
		</CardContent>
	</Card>
</template>
