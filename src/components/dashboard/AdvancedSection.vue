<script setup lang="ts">
import { computed } from 'vue'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import type { AdvancedSection, DeviceItem } from '@/composables/useDashboard'

const props = defineProps<{
	advanced: AdvancedSection
	devices: DeviceItem[]
}>()

const details = computed(() => [
	{ label: 'WordPress', value: props.advanced.wpVersion || '—' },
	{ label: 'PHP', value: props.advanced.phpVersion || '—' },
	{ label: 'Database', value: props.advanced.mysqlVersion || '—' },
	{ label: 'Server', value: props.advanced.serverSoftware || '—' },
	{ label: 'Environment', value: props.advanced.environment || '—' },
	{
		label: 'Plugins',
		value: `${props.advanced.pluginActiveCount} active / ${props.advanced.pluginCount} installed`,
	},
	{ label: 'Themes', value: `${props.advanced.themeCount}` },
	{ label: 'Memory limit', value: props.advanced.memoryLimit || '—' },
	{ label: 'Max upload', value: props.advanced.maxUploadSize || '—' },
	{ label: 'Debug mode', value: props.advanced.debugMode ? 'On' : 'Off' },
])

const deviceTotal = computed(() =>
	props.devices.reduce((sum, device) => sum + device.users, 0),
)
</script>

<template>
	<Card>
		<CardHeader>
			<CardTitle>Advanced details</CardTitle>
			<CardDescription>
				Technical information for developers and hosting support.
			</CardDescription>
		</CardHeader>
		<CardContent class="flex flex-col gap-6">
			<dl class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-3">
				<div
					v-for="detail in details"
					:key="detail.label"
					class="flex flex-col"
				>
					<dt class="text-muted-foreground text-xs">{{ detail.label }}</dt>
					<dd class="truncate font-medium" :title="detail.value">
						{{ detail.value }}
					</dd>
				</div>
			</dl>

			<div v-if="props.devices.length" class="flex flex-col gap-2">
				<h3 class="text-sm font-semibold">Visitors by device</h3>
				<ul class="flex flex-col gap-2">
					<li
						v-for="device in props.devices"
						:key="device.category"
						class="flex items-center gap-3 text-sm"
					>
						<span class="w-20 capitalize">{{ device.category }}</span>
						<div class="bg-muted h-2 flex-1 overflow-hidden rounded-full">
							<div
								class="bg-primary h-full rounded-full"
								:style="{
									width: `${deviceTotal ? (device.users / deviceTotal) * 100 : 0}%`,
								}"
							/>
						</div>
						<span class="text-muted-foreground w-12 text-right tabular-nums">
							{{ device.users.toLocaleString() }}
						</span>
					</li>
				</ul>
			</div>
		</CardContent>
	</Card>
</template>
