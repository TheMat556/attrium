import { expect, type Locator, type Page, test } from '@playwright/test'
import { applyTheme, stabilize, THEMES, type Theme } from './support/theme'

/**
 * theme-install.php Details/Preview full-screen overlay (`.theme-install-overlay
 * .wp-full-overlay`).
 *
 * `scss/screens/_theme-install.scss` reskins the overlay core renders when a
 * theme card on the installer is clicked: the nav buttons + action button in
 * the flexed header, the tokenized install-info / theme-details text, the
 * sidebar chrome + footer collapse arrow, and the fixed backdrop dimming the
 * whole shell. It is `display:none` until a card is clicked (theme.js
 * `preview`), and NO other capture opens it — so it previously had zero visual
 * coverage (a mutation audit could never see it). This spec opens it the same
 * way core does, giving the overlay reskin real coverage.
 *
 * Full-viewport capture, deliberately not `snapshotTarget()`: like the
 * themes.php overlay, the overlay is viewport-fixed (`position: fixed;
 * inset: 0`) and hides the theme grid behind it, so the fixed 1440x900
 * viewport is exactly what the user sees.
 *
 * The preview iframe (`.wp-full-overlay-main`) loads a non-deterministic URL
 * (in the fixture, `http://example.com/fixture-theme-one`), so it is masked —
 * the same reason the Customizer spec excludes its live-preview iframe. That
 * masks only the `.wp-full-overlay-main` background-color declaration; every
 * other overlay rule stays in coverage.
 *
 * Deterministic: the first theme card is fixture theme one (themes_api stubbed
 * by the determinism mu-plugin), and the screenshot/ratings are fixed text.
 */
async function openInstallOverlay(page: Page, theme: Theme): Promise<void> {
	await applyTheme(page, theme)
	await page.goto('/wp-admin/theme-install.php', {
		waitUntil: 'domcontentloaded',
	})
	await stabilize(page)
	// Clicking the theme card opens the details overlay (theme.js `preview`).
	// The card's centre is its screenshot, not the Preview/Install anchors, so
	// the click opens the overlay in-page rather than navigating.
	const card: Locator = page.locator('.theme-browser .theme').first()
	await card.click()
	await expect(
		page.locator('.theme-install-overlay.wp-full-overlay'),
	).toBeVisible()
}

for (const { theme } of THEMES) {
	test.describe(`theme: ${theme}`, () => {
		test('theme-install details overlay preview', async ({ page }) => {
			await openInstallOverlay(page, theme)
			await expect(page).toHaveScreenshot(
				`theme-install-overlay-${theme}.png`,
				{
					mask: [page.locator('.wp-full-overlay-main')],
				},
			)
		})
	})
}