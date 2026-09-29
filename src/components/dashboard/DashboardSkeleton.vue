<script setup lang="ts">
import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { DashboardMode } from '@/composables/useDashboard'

defineProps<{
	mode: DashboardMode
}>()
</script>

<template>
	<div class="flex flex-col gap-6">
		<div class="grid gap-4 @2xl/main:grid-cols-3">
			<Card v-for="n in 3" :key="n" class="@container/kpi h-36">
				<CardHeader class="pb-0">
					<div class="flex items-center gap-2">
						<Skeleton class="size-4 rounded-md" />
						<Skeleton class="h-4 w-28" />
					</div>
				</CardHeader>
				<CardContent class="flex min-h-0 flex-1 flex-col justify-center gap-2">
					<Skeleton class="h-8 w-24 @lg/kpi:h-9" />
					<Skeleton class="h-4 w-32" />
				</CardContent>
			</Card>
		</div>

		<div class="grid gap-4 @4xl/main:grid-cols-7">
			<Card class="@4xl/main:col-span-4">
				<CardHeader>
					<Skeleton class="h-5 w-16" />
					<Skeleton class="h-4 w-44" />
					<CardAction>
						<Skeleton class="h-8 w-28 rounded-lg" />
					</CardAction>
				</CardHeader>
				<CardContent class="flex flex-col gap-2">
					<Skeleton class="h-4 w-40" />
					<Skeleton class="h-60 w-full rounded-lg" />
				</CardContent>
			</Card>

			<Card class="@4xl/main:col-span-3">
				<CardHeader>
					<Skeleton class="h-5 w-24" />
					<Skeleton class="h-4 w-32" />
				</CardHeader>
				<CardContent class="flex flex-col gap-3">
					<div v-for="n in 5" :key="n" class="flex items-center gap-3 py-2">
						<Skeleton class="h-4 w-5 shrink-0" />
						<Skeleton class="h-4 flex-1" />
						<Skeleton class="h-4 w-10 shrink-0" />
					</div>
				</CardContent>
			</Card>
		</div>

		<Card>
			<CardHeader>
				<Skeleton class="h-5 w-16" />
				<Skeleton class="h-4 w-56" />
				<CardAction>
					<Skeleton class="h-5 w-16 rounded-full" />
				</CardAction>
			</CardHeader>
			<CardContent class="flex flex-col gap-3">
				<div
					v-for="n in 3"
					:key="n"
					class="flex items-center justify-between gap-3 py-2"
				>
					<div class="flex flex-col gap-1.5">
						<Skeleton class="h-4 w-40" />
						<Skeleton class="h-3 w-24" />
					</div>
					<Skeleton class="h-5 w-16 shrink-0 rounded-full" />
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardHeader>
				<Skeleton class="h-5 w-24" />
				<Skeleton class="h-4 w-64" />
				<CardAction>
					<Skeleton class="h-5 w-16 rounded-full" />
				</CardAction>
			</CardHeader>
			<CardContent class="flex flex-col gap-5">
				<div v-for="n in 2" :key="n" class="flex flex-col gap-2">
					<Skeleton class="h-4 w-28" />
					<Skeleton class="h-12 w-full rounded-lg" />
				</div>
			</CardContent>
		</Card>

		<Card v-if="mode === 'advanced'">
			<CardHeader>
				<Skeleton class="h-5 w-36" />
				<Skeleton class="h-4 w-72" />
			</CardHeader>
			<CardContent class="flex flex-col gap-6">
				<div class="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
					<div v-for="n in 9" :key="n" class="flex flex-col gap-1.5">
						<Skeleton class="h-3 w-16" />
						<Skeleton class="h-4 w-20" />
					</div>
				</div>
				<div class="flex flex-col gap-2">
					<Skeleton class="h-4 w-32" />
					<div v-for="n in 3" :key="n" class="flex items-center gap-3">
						<Skeleton class="h-4 w-20" />
						<Skeleton class="h-2 flex-1 rounded-full" />
						<Skeleton class="h-4 w-12" />
					</div>
				</div>
			</CardContent>
		</Card>
	</div>
</template>
