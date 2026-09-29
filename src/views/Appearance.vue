<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { wpFetch } from '@/lib/api'

// Native Attrium settings view (toplevel_page_attrium): the admin URLs excluded
// from content styling and the dashboard integrations. Secrets are read from
// wp-config constants, never entered or stored here.

const IGNORED_URLS_ENDPOINT = 'attrium/v1/ignored-urls'
type IgnoredUrlsResponse = { urls: string }

const urls = ref('')
const loading = ref(true)
const saving = ref(false)
const saved = ref(false)
const error = ref('')

async function load() {
	loading.value = true
	error.value = ''
	try {
		const data = await wpFetch<IgnoredUrlsResponse>(IGNORED_URLS_ENDPOINT)
		urls.value = data.urls
	} catch {
		error.value = 'Could not load the ignored URLs.'
	} finally {
		loading.value = false
	}
}

onMounted(load)

async function save() {
	saving.value = true
	saved.value = false
	error.value = ''
	try {
		const data = await wpFetch<IgnoredUrlsResponse>(IGNORED_URLS_ENDPOINT, {
			method: 'POST',
			body: JSON.stringify({ urls: urls.value }),
		})
		urls.value = data.urls
		saved.value = true
	} catch {
		error.value = 'Could not save the ignored URLs.'
	} finally {
		saving.value = false
	}
}

// ── Integrations ────────────────────────────────────────────────────
const INTEGRATIONS_ENDPOINT = 'attrium/v1/dashboard/integrations'
const INTEGRATIONS_TEST_ENDPOINT = 'attrium/v1/dashboard/integrations/test'

interface IntegrationsConfig {
	ga4: {
		propertyId: string
		credentialsSource: string
		credentialsConfigured: boolean
		credentialsEmail: string
		configured: boolean
	}
	uptimerobot: {
		monitorId: string
		apiKeyConfigured: boolean
		configured: boolean
	}
	backup: {
		overdueDays: number
		provider: string
		installed: boolean
	}
	constants: {
		ga4CredentialsPath: string
		ga4CredentialsJson: string
		uptimerobotApiKey: string
	}
}

interface TestResult {
	ok: boolean
	message: string
}
type TestResults = Partial<Record<'ga4' | 'uptimerobot' | 'backup', TestResult>>

const config = ref<IntegrationsConfig | null>(null)
const ga4PropertyId = ref('')
const uptimerobotMonitorId = ref('')
const backupOverdueDays = ref(7)
const integrationsLoading = ref(true)
const integrationsSaving = ref(false)
const integrationsSaved = ref(false)
const integrationsError = ref('')
const testing = ref(false)
const testResults = ref<TestResults | null>(null)

async function loadIntegrations() {
	integrationsLoading.value = true
	integrationsError.value = ''
	try {
		const data = await wpFetch<IntegrationsConfig>(INTEGRATIONS_ENDPOINT)
		config.value = data
		ga4PropertyId.value = data.ga4.propertyId
		uptimerobotMonitorId.value = data.uptimerobot.monitorId
		backupOverdueDays.value = data.backup.overdueDays
	} catch {
		integrationsError.value = 'Could not load integration settings.'
	} finally {
		integrationsLoading.value = false
	}
}

onMounted(loadIntegrations)

async function saveIntegrations() {
	integrationsSaving.value = true
	integrationsSaved.value = false
	integrationsError.value = ''
	testResults.value = null
	try {
		const data = await wpFetch<IntegrationsConfig>(INTEGRATIONS_ENDPOINT, {
			method: 'POST',
			body: JSON.stringify({
				ga4PropertyId: ga4PropertyId.value,
				uptimerobotMonitorId: uptimerobotMonitorId.value,
				backupOverdueDays: backupOverdueDays.value,
			}),
		})
		config.value = data
		integrationsSaved.value = true
	} catch {
		integrationsError.value = 'Could not save integration settings.'
	} finally {
		integrationsSaving.value = false
	}
}

async function testIntegrations() {
	testing.value = true
	testResults.value = null
	integrationsError.value = ''
	try {
		testResults.value = await wpFetch<TestResults>(INTEGRATIONS_TEST_ENDPOINT, {
			method: 'POST',
			body: JSON.stringify({}),
		})
	} catch {
		integrationsError.value = 'Could not reach the integration test endpoint.'
	} finally {
		testing.value = false
	}
}
</script>

<template>
	<div class="flex flex-col gap-6 px-4 py-4 md:px-6 md:py-6">
		<div class="flex flex-col gap-1">
			<h1 class="text-2xl font-semibold tracking-tight">Appearance</h1>
			<p class="text-muted-foreground text-sm">
				Control which admin pages Attrium styles, and connect the data behind
				your dashboard.
			</p>
		</div>

		<Card>
			<CardHeader>
				<CardTitle class="text-base">Ignored URLs</CardTitle>
				<CardDescription>
					One URL or path per line. Any page whose address contains a line is
					excluded from Attrium's content styling — the sidebar, header and
					content card stay, but the page content keeps its native WordPress
					look.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Textarea
					v-model="urls"
					:disabled="loading || saving"
					class="min-h-40 font-mono text-sm"
					placeholder="edit.php?post_type=page&#10;https://example.com/wp-admin/options-general.php"
					@input="saved = false"
				/>
				<p v-if="error" class="text-destructive mt-2 text-sm">{{ error }}</p>
			</CardContent>
			<CardFooter class="gap-3">
				<Button :disabled="loading || saving" @click="save">
					{{ saving ? 'Saving…' : 'Save' }}
				</Button>
				<span v-if="saved" class="text-muted-foreground text-sm">Saved.</span>
			</CardFooter>
		</Card>

		<Card>
			<CardHeader>
				<CardTitle class="text-base">Integrations</CardTitle>
				<CardDescription>
					Connect the data sources shown on the dashboard. API keys are read
					from<code>wp-config.php</code> and are never stored in the database or
					sent to the browser.
				</CardDescription>
			</CardHeader>
			<CardContent class="flex flex-col gap-6">
				<div class="flex flex-col gap-2">
					<div class="flex items-center justify-between gap-2">
						<h3 class="text-sm font-semibold">Google Analytics</h3>
						<Badge :variant="config?.ga4.configured ? 'secondary' : 'outline'">
							{{ config?.ga4.configured ? 'Connected' : 'Not connected' }}
						</Badge>
					</div>
					<Input
						v-model="ga4PropertyId"
						:disabled="integrationsLoading"
						placeholder="GA4 property ID, e.g. 123456789"
						@input="integrationsSaved = false"
					/>
					<p class="text-muted-foreground text-xs">
						<template v-if="config?.ga4.credentialsConfigured">
							Service account
							<strong>{{ config.ga4.credentialsEmail || 'configured' }}</strong>
							detected via
							<code>{{ config.ga4.credentialsSource }}</code>
							.
						</template>
						<template v-else>
							Add credentials with
							<code>
								define('{{ config?.constants.ga4CredentialsPath }}
								', '/path/to/service-account.json');
							</code>
							in<code>wp-config.php</code>
							.
						</template>
					</p>
				</div>

				<div class="flex flex-col gap-2">
					<div class="flex items-center justify-between gap-2">
						<h3 class="text-sm font-semibold">UptimeRobot</h3>
						<Badge
							:variant="config?.uptimerobot.configured ? 'secondary' : 'outline'"
						>
							{{ config?.uptimerobot.configured ? 'Connected' : 'Not connected' }}
						</Badge>
					</div>
					<Input
						v-model="uptimerobotMonitorId"
						:disabled="integrationsLoading"
						placeholder="Monitor ID, e.g. 788012345"
						@input="integrationsSaved = false"
					/>
					<p class="text-muted-foreground text-xs">
						<template v-if="config?.uptimerobot.apiKeyConfigured">
							API key detected.
						</template>
						<template v-else>
							Add a read-only key with
							<code>
								define('{{ config?.constants.uptimerobotApiKey }}
								', 'ur...');
							</code>
							in<code>wp-config.php</code>
							.
						</template>
					</p>
				</div>

				<div class="flex flex-col gap-2">
					<div class="flex items-center justify-between gap-2">
						<h3 class="text-sm font-semibold">Backups (UpdraftPlus)</h3>
						<Badge
							:variant="config?.backup.installed ? 'secondary' : 'outline'"
						>
							{{ config?.backup.installed ? 'Detected' : 'Not detected' }}
						</Badge>
					</div>
					<label
						class="text-muted-foreground text-xs"
						for="attrium-backup-days"
					>
						Flag the last backup as overdue after
					</label>
					<div class="flex items-center gap-2">
						<Input
							id="attrium-backup-days"
							v-model.number="backupOverdueDays"
							type="number"
							min="1"
							max="90"
							class="w-24"
							:disabled="integrationsLoading"
							@input="integrationsSaved = false"
						/>
						<span class="text-muted-foreground text-sm">days</span>
					</div>
				</div>

				<div v-if="testResults" class="flex flex-col gap-2">
					<div
						v-for="(result, key) in testResults"
						:key="key"
						class="flex items-center gap-2 text-sm"
					>
						<Badge :variant="result?.ok ? 'secondary' : 'destructive'">
							{{ key }}
						</Badge>
						<span class="text-muted-foreground">{{ result?.message }}</span>
					</div>
				</div>

				<p v-if="integrationsError" class="text-destructive text-sm">
					{{ integrationsError }}
				</p>
			</CardContent>
			<CardFooter class="gap-3">
				<Button
					:disabled="integrationsLoading || integrationsSaving"
					@click="saveIntegrations"
				>
					{{ integrationsSaving ? 'Saving…' : 'Save integrations' }}
				</Button>
				<Button
					variant="outline"
					:disabled="integrationsLoading || testing"
					@click="testIntegrations"
				>
					{{ testing ? 'Testing…' : 'Test connections' }}
				</Button>
				<span v-if="integrationsSaved" class="text-muted-foreground text-sm">
					Saved.
				</span>
			</CardFooter>
		</Card>
	</div>
</template>
