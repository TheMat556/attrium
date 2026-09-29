<script setup lang="ts">
import {
	Activity,
	AlertTriangle,
	ArrowRight,
	ChartNoAxesColumn,
	CircleCheck,
	CloudOff,
	DatabaseBackup,
	RefreshCw,
	ShieldOff,
	Users,
} from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import AdvancedSection from '@/components/dashboard/AdvancedSection.vue'
import DashboardSkeleton from '@/components/dashboard/DashboardSkeleton.vue'
import KpiCard from '@/components/dashboard/KpiCard.vue'
import SeverityBadge from '@/components/dashboard/SeverityBadge.vue'
import SiteHealthSection from '@/components/dashboard/SiteHealthSection.vue'
import TrafficChart from '@/components/dashboard/TrafficChart.vue'
import UpdatesSection from '@/components/dashboard/UpdatesSection.vue'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
	collectIssues,
	type DashboardRange,
	relativeFrom,
	useDashboard,
	worstSeverity,
} from '@/composables/useDashboard'
import { useServerData } from '@/composables/useServerData'

const { userName, adminUrl, canManage } = useServerData()
const {
	loading,
	error,
	mode,
	range,
	summary,
	uptime,
	traffic,
	trafficByRange,
	load,
	refresh,
	setRange,
} = useDashboard()

const appearanceUrl = `${adminUrl}admin.php?page=attrium`

onMounted(() => {
	if (canManage) load()
	else loading.value = false
})

const greeting = computed(() => {
	const hour = new Date().getHours()
	if (hour < 12) return 'Good morning'
	if (hour < 18) return 'Good afternoon'
	return 'Good evening'
})

const issues = computed(() =>
	collectIssues(summary.value, traffic.value, uptime.value),
)

const heroSeverity = computed(() =>
	worstSeverity(issues.value.map((i) => i.severity)),
)

const greetingTitle = computed(() => {
	const name = userName || 'there'
	return `${greeting.value}, ${name}`
})

const showHeroStatus = computed(
	() => canManage && !error.value && summary.value !== null,
)

const lastChecked = computed(() =>
	relativeFrom(summary.value?.generatedAt ?? null),
)

const heroPillLabel = computed(() => {
	const count = issues.value.length
	if (count === 0) return 'All clear'
	return heroSeverity.value === 'critical'
		? `${count} urgent`
		: `${count} to review`
})

const heroMeta = computed(() => {
	const updated = lastChecked.value ? `Updated ${lastChecked.value}` : ''
	const count = issues.value.length
	const status =
		count === 0
			? 'Everything looks good'
			: `${count} ${count === 1 ? 'item needs' : 'items need'} attention`
	return [status, updated].filter(Boolean).join(' · ')
})

const traffic7 = computed(() => trafficByRange.value[7] ?? null)
type KpiState = 'configured' | 'unconfigured' | 'issue'

const uptimeState = computed<KpiState>(() => {
	if (uptime.value?.state === 'not_configured') return 'unconfigured'
	if (uptime.value?.severity !== 'healthy') return 'issue'
	return 'configured'
})
const trafficState = computed<KpiState>(() => {
	if (traffic7.value?.state === 'not_configured') return 'unconfigured'
	if (traffic7.value?.severity !== 'healthy') return 'issue'
	return 'configured'
})
const backupState = computed<KpiState>(() => {
	if (summary.value?.backup.state === 'unavailable') return 'unconfigured'
	if (summary.value?.backup.severity !== 'healthy') return 'issue'
	return 'configured'
})
const refreshing = ref(false)

async function onRefresh() {
	refreshing.value = true
	try {
		await refresh()
	} finally {
		refreshing.value = false
	}
}

function onRangeChange(value: unknown) {
	if (value === '7' || value === 30 || value === '30') {
		setRange(Number(value) as DashboardRange)
	}
}

const deviceBreakdown = computed(() => traffic.value?.devices ?? [])
</script>

<template>
	<div class="flex flex-col gap-6 px-4 py-4 md:px-6 md:py-6">
		<header
			class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
		>
			<div class="flex flex-col gap-1.5">
				<SeverityBadge
					v-if="showHeroStatus"
					:severity="heroSeverity"
					:label="heroPillLabel"
					class="w-fit"
				/>
				<h1
					class="text-foreground text-2xl font-semibold tracking-tight text-balance md:text-3xl"
				>
					{{ greetingTitle }}
				</h1>
				<p
					class="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
				>
					<span v-if="showHeroStatus">{{ heroMeta }}</span>
					<span v-else-if="loading">Checking your site…</span>
					<Button
						variant="ghost"
						size="icon-xs"
						:disabled="loading || refreshing"
						aria-label="Refresh dashboard"
						@click="onRefresh"
					>
						<RefreshCw :class="refreshing ? 'animate-spin' : ''" />
					</Button>
				</p>
			</div>

			<Tabs v-model="mode">
				<TabsList>
					<TabsTrigger value="basic">Basic</TabsTrigger>
					<TabsTrigger value="advanced">Advanced</TabsTrigger>
				</TabsList>
			</Tabs>
		</header>

		<DashboardSkeleton v-if="loading" :mode="mode" />

		<Card v-else-if="!canManage">
			<CardHeader>
				<CardTitle>Site health is private</CardTitle>
				<CardDescription>
					Health and update information is available to site administrators. Ask
					an administrator if you need access.
				</CardDescription>
			</CardHeader>
		</Card>

		<Card v-else-if="error">
			<CardHeader>
				<CardTitle>We couldn't load your dashboard</CardTitle>
				<CardDescription>{{ error }}</CardDescription>
			</CardHeader>
			<CardContent>
				<Button @click="onRefresh">Try again</Button>
			</CardContent>
		</Card>

		<template v-else-if="summary">
			<div class="grid gap-4 @2xl/main:grid-cols-3">
				<KpiCard
					title="Uptime (30 days)"
					:icon="Activity"
					:state="uptimeState"
					:state-icon="uptimeState === 'unconfigured' ? CloudOff : AlertTriangle"
					:value="uptime?.uptime30d !== null && uptime?.uptime30d !== undefined ? `${uptime.uptime30d}%` : ''"
					:description="
						uptime?.state === 'not_configured'
							? 'Not connected'
							: uptime?.state === 'ok'
							? uptime.statusText
							: uptime?.message || 'Uptime data is unavailable'
					"
					:severity="uptime?.severity ?? 'warning'"
					:action-label="uptimeState === 'unconfigured' ? 'Connect' : ''"
					:action-url="uptimeState === 'unconfigured' ? appearanceUrl : ''"
				/>

				<KpiCard
					title="Visitors (7 days)"
					:icon="Users"
					:state="trafficState"
					:state-icon="trafficState === 'unconfigured' ? ChartNoAxesColumn : AlertTriangle"
					:value="trafficState === 'configured' ? (traffic7?.visitors ?? 0).toLocaleString() : ''"
					:trend="traffic7?.state === 'ok' ? traffic7.deltaPct : null"
					:description="
						traffic7?.state === 'not_configured'
							? 'Not connected'
							: traffic7?.state === 'ok'
								? 'vs previous 7 days'
								: traffic7?.message || 'Traffic data is unavailable'
					"
					:severity="traffic7?.severity ?? 'warning'"
					:action-label="trafficState === 'unconfigured' ? 'Connect' : ''"
					:action-url="trafficState === 'unconfigured' ? appearanceUrl : ''"
				/>

				<KpiCard
					title="Last backup"
					:icon="DatabaseBackup"
					:state="backupState"
					:state-icon="backupState === 'unconfigured' ? ShieldOff : DatabaseBackup"
					:value="summary.backup.human"
					:description="
						summary.backup.state === 'unavailable'
							? 'Backups not set up'
							: summary.backup.state === 'no_backup'
								? 'No successful backup yet'
								: 'UpdraftPlus'
					"
					:severity="summary.backup.severity"
					:action-label="backupState === 'unconfigured' ? 'Set up' : ''"
					:action-url="backupState === 'unconfigured' ? summary.backup.actionUrl : ''"
				/>
			</div>

			<div class="grid gap-4 @4xl/main:grid-cols-7">
				<Card class="@4xl/main:col-span-4">
					<CardHeader>
						<CardTitle>Traffic</CardTitle>
						<CardDescription>
							{{ range === 7
									? 'Visitors over the last 7 days'
									: 'Visitors over the last 30 days' }}
						</CardDescription>
						<div
							class="col-start-2 row-span-2 row-start-1 self-start justify-self-end"
						>
							<Tabs
								:model-value="String(range)"
								@update:model-value="onRangeChange"
							>
								<TabsList>
									<TabsTrigger value="7">7 days</TabsTrigger>
									<TabsTrigger value="30">30 days</TabsTrigger>
								</TabsList>
							</Tabs>
						</div>
					</CardHeader>
					<CardContent>
						<template v-if="traffic?.state === 'ok' && traffic.points.length">
							<p class="text-muted-foreground mb-2 text-sm">
								<span
									v-if="traffic.deltaPct !== null"
									:class="
										(traffic.deltaPct ?? 0) >= 0
											? 'text-success'
											: 'text-critical'
									"
								>
									{{ (traffic.deltaPct ?? 0) > 0 ? '+' : '' }}
									{{ traffic.deltaPct }}
									%
								</span>
								<span v-else>No prior data</span>
								vs previous period
							</p>
							<TrafficChart :points="traffic.points" />
						</template>
						<div
							v-else-if="traffic?.state === 'ok'"
							class="text-success flex min-h-36 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center text-sm"
						>
							<CircleCheck class="size-6 shrink-0" />
							<span>No traffic recorded for this period.</span>
						</div>
						<div
							v-else
							:class="[
								'flex min-h-36 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center text-sm',
								traffic?.state === 'not_configured'
									? 'text-muted-foreground'
									: 'text-warning',
							]"
						>
							<div class="flex flex-col items-center gap-2">
								<component
									:is="traffic?.state === 'not_configured' ? ChartNoAxesColumn : AlertTriangle"
									class="size-6 shrink-0"
								/>
								<span>
									{{ traffic?.message || 'Traffic data is unavailable.' }}
								</span>
							</div>
							<a
								v-if="traffic?.state === 'not_configured'"
								:href="appearanceUrl"
								class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-medium"
							>
								Connect analytics
								<ArrowRight class="size-3.5" />
							</a>
						</div>
					</CardContent>
				</Card>

				<Card class="@4xl/main:col-span-3">
					<CardHeader>
						<CardTitle>Top content</CardTitle>
						<CardDescription>Most viewed pages</CardDescription>
					</CardHeader>
					<CardContent>
						<ul
							v-if="traffic?.state === 'ok' && traffic.topContent.length"
							class="flex flex-col divide-y"
						>
							<li
								v-for="(item, index) in traffic.topContent"
								:key="`${item.title}-${index}`"
								class="flex items-center gap-3 py-2"
							>
								<span class="text-muted-foreground w-5 text-sm tabular-nums">
									{{ index + 1 }}
								</span>
								<span
									class="min-w-0 flex-1 truncate text-sm"
									:title="item.title"
								>
									{{ item.title }}
								</span>
								<span class="text-muted-foreground text-sm tabular-nums">
									{{ item.views.toLocaleString() }}
								</span>
							</li>
						</ul>
						<div
							v-else-if="traffic?.state === 'ok'"
							class="text-success flex min-h-36 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center text-sm"
						>
							<CircleCheck class="size-6 shrink-0" />
							<span>No content views yet.</span>
						</div>
						<div
							v-else
							:class="[
								'flex min-h-36 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center text-sm',
								traffic?.state === 'not_configured'
									? 'text-muted-foreground'
									: 'text-warning',
							]"
						>
							<component
								:is="traffic?.state === 'not_configured' ? ChartNoAxesColumn : AlertTriangle"
								class="size-6 shrink-0"
							/>
							<span>
								{{ traffic?.state === 'not_configured' ? 'Connect analytics to see top content.' : 'Top content is unavailable.' }}
							</span>
						</div>
					</CardContent>
				</Card>
			</div>

			<UpdatesSection :updates="summary.updates" />

			<SiteHealthSection :site-health="summary.siteHealth" />

			<AdvancedSection
				v-if="mode === 'advanced'"
				:advanced="summary.advanced"
				:devices="deviceBreakdown"
			/>
		</template>
	</div>
</template>
