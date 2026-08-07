import { expect, type Locator, type Page, test } from '@playwright/test'
import { applyTheme, stabilize, THEMES, type Theme } from '../support/theme'

/**
 * Table regression.
 *
 * The `scss/modules/_tables.scss` module restyles WordPress's `.widefat` list
 * tables (generic rules) plus a dedicated block for `.widefat.plugins`. It also
 * styles the surrounding table furniture: `p.search-box`, the `.tablenav`
 * pagination bars, and the sortable/comment header cells.
 *
 * Unlike forms/notices there is nothing to inject — real list screens render
 * everything the module touches, so each capture targets a live element.
 * Users/plugins/posts screens are captured full-page in the page suite, but
 * those catches are far away; element captures here are what make a one-line
 * removal show up loudly during cleanup.
 */

async function open(page: Page, theme: Theme, path: string): Promise<void> {
	await applyTheme(page, theme)
	await page.goto(path, { waitUntil: 'domcontentloaded' })
	await stabilize(page)
}

for (const { theme } of THEMES) {
	test.describe(`theme: ${theme}`, () => {
		test('users table', async ({ page }) => {
			await open(page, theme, '/wp-admin/users.php')
			const table: Locator = page.locator('.widefat')
			await expect(table).toBeVisible()
			await table.scrollIntoViewIfNeeded()
			await expect(table).toHaveScreenshot(`table-users-${theme}.png`)
		})

		test('plugins table', async ({ page }) => {
			await open(page, theme, '/wp-admin/plugins.php')
			const table: Locator = page.locator('.widefat.plugins')
			await expect(table).toBeVisible()
			await table.scrollIntoViewIfNeeded()
			await expect(table).toHaveScreenshot(`table-plugins-${theme}.png`)
		})

		test('search box', async ({ page }) => {
			await open(page, theme, '/wp-admin/users.php')
			const search: Locator = page.locator('p.search-box')
			await expect(search).toBeVisible()
			await search.scrollIntoViewIfNeeded()
			await expect(search).toHaveScreenshot(`table-search-box-${theme}.png`)
		})

		test('tablenav top', async ({ page }) => {
			await open(page, theme, '/wp-admin/users.php')
			const tablenav: Locator = page.locator('.tablenav.top')
			await expect(tablenav).toBeVisible()
			await tablenav.scrollIntoViewIfNeeded()
			await expect(tablenav).toHaveScreenshot(`table-tablenav-top-${theme}.png`)
		})

		test('tablenav bottom', async ({ page }) => {
			await open(page, theme, '/wp-admin/users.php')
			const tablenav: Locator = page.locator('.tablenav.bottom')
			await expect(tablenav).toBeVisible()
			await tablenav.scrollIntoViewIfNeeded()
			await expect(tablenav).toHaveScreenshot(
				`table-tablenav-bottom-${theme}.png`,
			)
		})

		test('posts list header', async ({ page }) => {
			await open(page, theme, '/wp-admin/edit.php')
			const thead: Locator = page.locator('table.widefat thead')
			await expect(thead).toBeVisible()
			await thead.scrollIntoViewIfNeeded()
			await expect(thead).toHaveScreenshot(`table-posts-thead-${theme}.png`)
		})
	})
}
