import { expect, type Locator, type Page, test } from '@playwright/test'
import { applyTheme, stabilize, THEMES, type Theme } from '../support/theme'

/**
 * Plugins-screen regression.
 *
 * `scss/screens/_plugins.scss` holds exactly one rule: hide the bottom
 * toolbar's bulk-actions block (`ui.hide-bottom-bulk-actions`), because the
 * Attrium shell header already provides bulk-action controls. Everything else
 * on the plugins screen is owned by modules — the `.subsubsub` tabs by tabs,
 * the `.widefat.plugins` table and tablenav bars by tables — and covered by
 * their own specs.
 *
 * This spec pins the one screen-local behavior: the TOP tablenav keeps its
 * bulk-actions (that's where core puts them on this screen) while the BOTTOM
 * one has them hidden, leaving only the item count and pagination. Capturing
 * both makes the hide rule hard to remove silently.
 */

async function open(page: Page, theme: Theme): Promise<void> {
	await applyTheme(page, theme)
	await page.goto('/wp-admin/plugins.php', { waitUntil: 'domcontentloaded' })
	await stabilize(page)
}

for (const { theme } of THEMES) {
	test.describe(`theme: ${theme}`, () => {
		test('top tablenav keeps bulk actions', async ({ page }) => {
			await open(page, theme)
			const tablenav: Locator = page.locator('.tablenav.top')
			await expect(tablenav).toBeVisible()
			await tablenav.scrollIntoViewIfNeeded()
			await expect(tablenav).toHaveScreenshot(`plugins-tablenav-top-${theme}.png`)
		})

		test('bottom tablenav hides bulk actions', async ({ page }) => {
			await open(page, theme)
			const tablenav: Locator = page.locator('.tablenav.bottom')
			await expect(tablenav).toBeVisible()
			await tablenav.scrollIntoViewIfNeeded()
			await expect(tablenav).toHaveScreenshot(
				`plugins-tablenav-bottom-${theme}.png`,
			)
		})
	})
}
