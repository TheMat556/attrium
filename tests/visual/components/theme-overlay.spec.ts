import { expect, type Locator, type Page, test } from '@playwright/test'
import { applyTheme, stabilize, THEMES, type Theme } from '../support/theme'

/**
 * Theme Details full-screen overlay (`.wp-full-overlay`).
 *
 * `scss/screens/_theme-install.scss` tokenizes the installer's Details/Preview
 * overlay: the sidebar surface, header nav buttons, content panel, theme info
 * text, and collapse footer. The overlay is `display:none` until a theme card
 * is clicked (theme.js `preview`), so this spec opens it the same way core
 * does before screenshotting.
 *
 * Only the `.wp-full-overlay-sidebar` is captured, not the whole overlay: the
 * right `.wp-full-overlay-main` pane hosts a live theme-preview iframe whose
 * `theme_information` is fetched from wp.org on open (the determinism mu-plugin
 * only stubs `query_themes`), so it is not deterministic. The sidebar is fed by
 * the stubbed fixture catalog and is fully deterministic.
 */
async function openOverlay(page: Page, theme: Theme): Promise<void> {
	await applyTheme(page, theme)
	await page.goto('/wp-admin/theme-install.php', {
		waitUntil: 'domcontentloaded',
	})
	await stabilize(page)
	// Clicking a theme card opens the preview overlay (theme.js `preview`).
	const card: Locator = page.locator('.theme-browser .theme').first()
	await card.click()
	await expect(page.locator('.wp-full-overlay-sidebar')).toBeVisible()
}

for (const { theme } of THEMES) {
	test.describe(`theme: ${theme}`, () => {
		test('theme details overlay sidebar', async ({ page }) => {
			await openOverlay(page, theme)
			const sidebar: Locator = page.locator('.wp-full-overlay-sidebar')
			await sidebar.scrollIntoViewIfNeeded()
			await expect(sidebar).toHaveScreenshot(
				`theme-overlay-sidebar-${theme}.png`,
			)
		})
	})
}
