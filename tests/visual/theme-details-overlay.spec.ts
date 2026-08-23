import { expect, type Locator, type Page, test } from '@playwright/test'
import { applyTheme, stabilize, THEMES, type Theme } from './support/theme'

/**
 * Themes.php Details/Preview modal (`.theme-overlay`).
 *
 * `scss/screens/_themes.scss` reskins the modal core renders when a theme card
 * is clicked: the header nav buttons (Lucide masks on an `::after` overlay),
 * the tokenized info text, and — the point of this spec — the backdrop.
 * Core's backdrop is an absolute scrim over `.wrap` only
 * (`rgba(240,240,241,.9)`, a white band in dark mode) that never reaches the
 * Attrium sidebar/header; our rule makes it `position: fixed; inset: 0` with a
 * dark scrim, so it must cover the whole shell. A full-viewport capture is the
 * regression check: if the backdrop stops covering the shell (or turns white),
 * the sidebar/header regions of this snapshot change.
 *
 * The overlay is `display:none` until a theme card is clicked (theme.js
 * `preview`), so this spec opens it the same way core does. It deliberately
 * does NOT use `snapshotTarget()`: the overlay is viewport-fixed, so the fixed
 * 1440x900 viewport is exactly what the user sees (growing the viewport would
 * only pad the capture with dimmed backdrop below the modal).
 *
 * The modal content is deterministic: the first theme card is the active
 * bundled theme with a local screenshot, and the determinism mu-plugin freezes
 * the update transients the auto-update toggle reads.
 */
async function openDetailsOverlay(page: Page, theme: Theme): Promise<void> {
	await applyTheme(page, theme)
	await page.goto('/wp-admin/themes.php', { waitUntil: 'domcontentloaded' })
	await stabilize(page)
	// Clicking a theme card opens the details overlay (theme.js `preview`).
	const card: Locator = page.locator('.theme-browser .theme').first()
	await card.click()
	await expect(page.locator('.theme-overlay .theme-header')).toBeVisible()
}

for (const { theme } of THEMES) {
	test.describe(`theme: ${theme}`, () => {
		test('details overlay backdrop dims the shell', async ({ page }) => {
			await openDetailsOverlay(page, theme)
			await expect(page).toHaveScreenshot(
				`theme-details-overlay-${theme}.png`,
			)
		})
	})
}
