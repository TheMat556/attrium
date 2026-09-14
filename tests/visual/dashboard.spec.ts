import { expect, type Locator, type Page, test } from '@playwright/test'
import { applyTheme, snapshotTarget, stabilize, THEMES } from './support/theme'

/**
 * Client health dashboard regression.
 *
 * The dashboard is a native Attrium override (`src/views/Dashboard.vue`), so it
 * renders no `wp-content` slot and `stabilize()` is called with
 * `expectWpContent: false`. Its data comes from four sources; all four are
 * pinned offline by `mu-plugins/attrium-visual-dashboard.php`.
 *
 * The greeting and the "last checked" line are derived from the wall clock, so
 * the page clock is frozen before navigation — otherwise the baseline would
 * drift with the hour the suite runs. Queries are scoped to the override's
 * `<main>` so they cannot collide with the sidebar's own menu labels.
 */

const FIXED_NOW = new Date(2026, 0, 1, 15, 0, 0)

async function openDashboard(page: Page): Promise<Locator> {
	await page.clock.setFixedTime(FIXED_NOW)
	await page.goto('/wp-admin/index.php', { waitUntil: 'networkidle' })
	await stabilize(page, { expectWpContent: false })

	const main = page.locator('#attrium-host main')

	await expect(main.getByText('Site health')).toBeVisible({ timeout: 15_000 })
	await expect(main.getByText('Top content')).toBeVisible()
	// The area chart only mounts once traffic data resolves.
	await expect(main.locator('[data-slot="chart"]').first()).toBeVisible()

	return main
}

for (const { theme } of THEMES) {
	test(`dashboard basic ${theme}`, async ({ page }) => {
		await applyTheme(page, theme)
		await openDashboard(page)

		const target = await snapshotTarget(page)
		await expect(target).toHaveScreenshot(`dashboard-basic-${theme}.png`, {
			animations: 'disabled',
		})
	})
}

test('dashboard advanced shows technical details', async ({ page }) => {
	await applyTheme(page, 'light')
	const main = await openDashboard(page)

	// Basic mode hides the advanced panel entirely.
	await expect(main.getByText('Advanced details')).toHaveCount(0)

	await main.getByRole('tab', { name: 'Advanced' }).click()
	await expect(main.getByText('Advanced details')).toBeVisible()
	await expect(main.getByText('Visitors by device')).toBeVisible()

	const target = await snapshotTarget(page)
	await expect(target).toHaveScreenshot('dashboard-advanced-light.png', {
		animations: 'disabled',
	})
})
