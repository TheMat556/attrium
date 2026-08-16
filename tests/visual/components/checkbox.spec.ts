import { expect, type Locator, type Page, test } from '@playwright/test'
import { applyTheme, stabilize, THEMES, type Theme } from '../support/theme'

/**
 * Checkbox / radio regression.
 *
 * The `scss/modules/_checkbox.scss` module re-faces every `input[type=checkbox]`
 * and `input[type=radio]` through --attrium-* tokens: token ring border + token
 * surface, a lucide check masked onto the primary face when checked, and a
 * no-blue focus ring. Nothing needs injecting — real list screens render the
 * inputs, but the page-level captures never show a *checked* box (all rows start
 * unchecked), so the two states the module actually changes (checked, focused)
 * get their own element captures here.
 */

async function open(page: Page, theme: Theme, path: string): Promise<void> {
	await applyTheme(page, theme)
	await page.goto(path, { waitUntil: 'domcontentloaded' })
	await stabilize(page)
}

for (const { theme } of THEMES) {
	test.describe(`theme: ${theme}`, () => {
		test('checked rows', async ({ page }) => {
			await open(page, theme, '/wp-admin/users.php')
			const table: Locator = page.locator('.widefat')
			await expect(table).toBeVisible()
			await table.scrollIntoViewIfNeeded()
			await table
				.locator('thead .check-column input[type=checkbox]')
				.first()
				.check({ force: true })
			await expect(table).toHaveScreenshot(`checkbox-checked-${theme}.png`)
		})

		test('focus ring', async ({ page }) => {
			await open(page, theme, '/wp-admin/users.php')
			const selectAll: Locator = page.locator(
				'.widefat thead .check-column input[type=checkbox]',
			)
			await expect(selectAll).toBeVisible()
			await selectAll.first().check({ force: true })
			await expect(selectAll.first()).toBeFocused()
			await expect(selectAll.first()).toHaveScreenshot(
				`checkbox-focus-${theme}.png`,
			)
		})
	})
}
