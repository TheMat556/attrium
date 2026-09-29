import { expect, type Locator, type Page, test } from '@playwright/test'
import { applyTheme, snapshotTarget, stabilize, THEMES } from './support/theme'

/**
 * Attrium settings view regression (`src/views/Appearance.vue`).
 *
 * A native override (screen id `toplevel_page_attrium`), so it renders no
 * `wp-content` slot and `stabilize()` runs with `expectWpContent: false`. The
 * integrations config is pinned offline by `mu-plugins/attrium-visual-
 * determinism.php` (GA4 property + credentials, UptimeRobot key + monitor,
 * UpdraftPlus), so the badges resolve to their connected/detected state.
 */

async function openAppearance(page: Page): Promise<Locator> {
	await page.goto('/wp-admin/admin.php?page=attrium', {
		waitUntil: 'networkidle',
	})
	await stabilize(page, { expectWpContent: false })

	const main = page.locator('#attrium-host main')

	await expect(main.getByText('Ignored URLs')).toBeVisible({ timeout: 15_000 })
	// Exact: "Integrations" also matches the "Save integrations" button.
	await expect(
		main.getByText('Integrations', { exact: true }),
	).toBeVisible()
	// The badges start "Not connected" and flip once the config request
	// resolves; wait for the loaded state so the capture is deterministic.
	// Exact match so "Connected"/"Detected" don't match "Not connected" etc.
	await expect(
		main.getByText('Connected', { exact: true }).first(),
	).toBeVisible()
	await expect(main.getByText('Detected', { exact: true })).toBeVisible()

	return main
}

for (const { theme } of THEMES) {
	test(`appearance ${theme}`, async ({ page }) => {
		await applyTheme(page, theme)
		await openAppearance(page)

		const target = await snapshotTarget(page)
		await expect(target).toHaveScreenshot(`appearance-${theme}.png`, {
			animations: 'disabled',
		})
	})
}
