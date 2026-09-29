import { computed, ref } from 'vue'
import { wpFetch } from '@/lib/api'

/**
 * Data model + fetching for the client health dashboard. Ranking is duplicated
 * client-side on purpose: the hero verdict derives from the same values the
 * sections render, so it can't drift from them.
 */

export type Severity = 'critical' | 'warning' | 'healthy'
export type DashboardMode = 'basic' | 'advanced'
export type DashboardRange = 7 | 30

const SEVERITY_RANK: Record<Severity, number> = {
	healthy: 0,
	warning: 1,
	critical: 2,
}

export function worstSeverity(list: Severity[]): Severity {
	return list.reduce<Severity>(
		(worst, current) =>
			SEVERITY_RANK[current] > SEVERITY_RANK[worst] ? current : worst,
		'healthy',
	)
}

export interface UpdateItem {
	type: 'core' | 'plugin' | 'theme'
	name: string
	current: string
	new: string
	severity: Severity
	actionUrl: string
}

export interface UpdatesSection {
	severity: Severity
	total: number
	security: UpdateItem[]
	regular: UpdateItem[]
}

export interface HealthItem {
	id: string
	category: string
	label: string
	severity: Severity
	badge: string
	description: string
	actionUrl: string | null
	actionLabel: string | null
}

export interface HealthCategory {
	id: string
	label: string
	items: HealthItem[]
	issueCount: number
}

export interface SiteHealthSection {
	severity: Severity
	issueCount: number
	counts: Record<Severity, number>
	categories: HealthCategory[]
}

export interface BackupSection {
	provider: string
	available: boolean
	overdueDays: number
	actionUrl: string
	timestamp: number | null
	human: string
	state: 'ok' | 'overdue' | 'unavailable' | 'no_backup'
	severity: Severity
}

export interface AdvancedSection {
	wpVersion: string
	phpVersion: string
	serverSoftware: string
	mysqlVersion: string
	environment: string
	pluginCount: number
	pluginActiveCount: number
	themeCount: number
	memoryLimit: string
	maxUploadSize: string
	debugMode: boolean
}

export interface SummaryResponse {
	generatedAt: number
	updates: UpdatesSection
	siteHealth: SiteHealthSection
	backup: BackupSection
	advanced: AdvancedSection
}

export interface TrafficPoint {
	date: string
	users: number
	views: number
}

export interface TopContentItem {
	title: string
	path: string
	views: number
}

export interface DeviceItem {
	category: string
	users: number
}

export interface TrafficResponse {
	state: 'ok' | 'not_configured' | 'error'
	severity: Severity
	range: number
	visitors: number
	views: number
	prevVisitors: number
	prevViews: number
	deltaPct: number | null
	points: TrafficPoint[]
	topContent: TopContentItem[]
	devices: DeviceItem[]
	fetchedAt: number | null
	message: string
}

export interface UptimeResponse {
	state: 'ok' | 'stale' | 'not_configured' | 'error'
	severity: Severity
	monitorName: string
	url: string
	status: number | null
	statusText: string
	uptime30d: number | null
	fetchedAt: number | null
	message: string
}

export interface Issue {
	id: string
	label: string
	severity: Severity
}

const SUMMARY_ENDPOINT = 'attrium/v1/dashboard/summary'
const TRAFFIC_ENDPOINT = 'attrium/v1/dashboard/traffic'
const UPTIME_ENDPOINT = 'attrium/v1/dashboard/uptime'

export function useDashboard() {
	const loading = ref(true)
	const error = ref('')
	const mode = ref<DashboardMode>('basic')
	const range = ref<DashboardRange>(7)

	const summary = ref<SummaryResponse | null>(null)
	const uptime = ref<UptimeResponse | null>(null)
	const trafficByRange = ref<Partial<Record<DashboardRange, TrafficResponse>>>(
		{},
	)

	const traffic = computed<TrafficResponse | null>(
		() => trafficByRange.value[range.value] ?? null,
	)

	async function fetchSummary() {
		summary.value = await wpFetch<SummaryResponse>(SUMMARY_ENDPOINT)
	}

	async function fetchUptime() {
		uptime.value = await wpFetch<UptimeResponse>(UPTIME_ENDPOINT)
	}

	async function fetchTraffic(target: DashboardRange) {
		if (trafficByRange.value[target]) return

		const data = await wpFetch<TrafficResponse>(
			`${TRAFFIC_ENDPOINT}?range=${target}`,
		)
		trafficByRange.value = { ...trafficByRange.value, [target]: data }
	}

	async function load() {
		loading.value = true
		error.value = ''

		const results = await Promise.allSettled([
			fetchSummary(),
			fetchUptime(),
			fetchTraffic(7),
		])

		// The summary is the only mandatory payload; the rest degrade to
		// configuration/error states rendered inside their own cards.
		if (results[0]?.status === 'rejected') {
			error.value = 'Could not load your site health data.'
		}

		loading.value = false
	}

	async function setRange(next: DashboardRange) {
		range.value = next
		try {
			await fetchTraffic(next)
		} catch {
			// Card-level error state handles a failed range switch.
		}
	}

	async function refresh() {
		trafficByRange.value = {}
		await load()
	}

	return {
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
	}
}

/**
 * The single flat list of things needing attention, built from the same section
 * data the page renders — the hero count and highlighted cards all read from it.
 */
export function collectIssues(
	summary: SummaryResponse | null,
	traffic: TrafficResponse | null,
	uptime: UptimeResponse | null,
): Issue[] {
	const issues: Issue[] = []

	const updates = summary?.updates
	if (updates) {
		for (const item of updates.security) {
			issues.push({
				id: `update-security-${item.type}-${item.name}`,
				label: `${item.name} needs a security update`,
				severity: 'critical',
			})
		}
		for (const item of updates.regular) {
			issues.push({
				id: `update-regular-${item.type}-${item.name}`,
				label: `${item.name} has an update available`,
				severity: 'warning',
			})
		}
	}

	const backup = summary?.backup
	if (
		backup &&
		backup.state !== 'unavailable' &&
		backup.severity !== 'healthy'
	) {
		issues.push({
			id: 'backup',
			label:
				backup.state === 'no_backup'
					? 'No successful backup yet'
					: `Last backup was over ${backup.overdueDays} days ago`,
			severity: backup.severity,
		})
	}

	if (
		traffic &&
		traffic.state !== 'not_configured' &&
		traffic.severity !== 'healthy'
	) {
		issues.push({
			id: 'traffic',
			label: traffic.message || 'Traffic data needs attention',
			severity: traffic.severity,
		})
	}

	if (
		uptime &&
		uptime.state !== 'not_configured' &&
		uptime.severity !== 'healthy'
	) {
		issues.push({
			id: 'uptime',
			label: uptime.message || `Uptime monitor is ${uptime.statusText}`,
			severity: uptime.severity,
		})
	}

	for (const category of summary?.siteHealth.categories ?? []) {
		for (const item of category.items) {
			if (item.severity === 'healthy') continue
			issues.push({
				id: `health-${item.id}`,
				label: item.label,
				severity: item.severity,
			})
		}
	}

	return issues
}

/** "3 minutes ago" from a unix timestamp, or an empty string. */
export function relativeFrom(timestamp: number | null): string {
	if (!timestamp) return ''

	const seconds = Math.max(0, Math.floor(Date.now() / 1000) - timestamp)

	if (seconds < 60) {
		const s = Math.max(1, seconds)
		return `${s} second${s === 1 ? '' : 's'} ago`
	}

	const minutes = Math.floor(seconds / 60)
	if (minutes < 60) {
		return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
	}

	const hours = Math.floor(minutes / 60)
	if (hours < 24) {
		return `${hours} hour${hours === 1 ? '' : 's'} ago`
	}

	const days = Math.floor(hours / 24)
	return `${days} day${days === 1 ? '' : 's'} ago`
}
