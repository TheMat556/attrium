import { expect, type Locator, type Page, test } from '@playwright/test'
import { applyTheme, stabilize, THEMES, type Theme } from '../support/theme'

/**
 * In-card overlay notice ("Installed", update messages).
 *
 * `_themes.scss` pins notices inside a `.theme` card to the card's top with
 * absolute positioning, a 0.5rem inset, and compact padding — but core only
 * renders that notice after an actual install/update action, so no full-page
 * snapshot ever contains one. This spec injects the exact markup core's JS
 * produces (`wp.updates` → `notice notice-success notice-alt`) into the first
 * installed theme card and snapshots the card, locking the compact pill look.
 */
async function openWithNotice(page: Page, theme: Theme): Promise<void> {
	await applyTheme(page, theme)
	await page.goto('/wp-admin/themes.php', { waitUntil: 'domcontentloaded' })
	await stabilize(page)
	await page.evaluate(() => {
		const card = document.querySelector<HTMLElement>('.theme-browser .theme')
		card?.insertAdjacentHTML(
			'afterbegin',
			'<div class="notice notice-success notice-alt"><p>Installed</p></div>',
		)
	})
}

for (const { theme } of THEMES) {
	test.describe(`theme: ${theme}`, () => {
		test('in-card installed notice', async ({ page }) => {
			await openWithNotice(page, theme)
			const card: Locator = page.locator('.theme-browser .theme').first()
			await expect(card.locator('.notice')).toBeVisible()
			await expect(card).toHaveScreenshot(`theme-card-notice-${theme}.png`)
		})
	})
}
