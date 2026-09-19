import { expect, type Locator, type Page, test } from '@playwright/test'
import { applyTheme, stabilize, THEMES, type Theme } from '../support/theme'

/**
 * Tabs regression: `scss/modules/_tabs.scss` restyles `.subsubsub` list-table tabs (shadcn
 * <TabsList>/<TabsTrigger> cva) and hides core's ` | ` separators. Guards box/`li` flattening/count/hover/focus.
 */

async function open(page: Page, theme: Theme, path: string): Promise<void> {
	await applyTheme(page, theme)
	await page.goto(path, { waitUntil: 'domcontentloaded' })
	await stabilize(page)
}

for (const { theme } of THEMES) {
	test.describe(`theme: ${theme}`, () => {
		let tabs: Locator

		test.beforeEach(async ({ page }) => {
			await open(page, theme, '/wp-admin/edit.php')
			tabs = page.locator('.subsubsub')
			await expect(tabs).toBeVisible()
			await tabs.scrollIntoViewIfNeeded()
		})

		test('posts filter tabs', async () => {
			await expect(tabs).toHaveScreenshot(`tabs-posts-${theme}.png`)
		})

		test('posts filter tab link', async () => {
			const link: Locator = tabs.locator('li a.current')
			await expect(link).toHaveScreenshot(`tabs-posts-link-${theme}.png`)
		})

		test('unselected tab hover', async ({ page }) => {
			const link: Locator = tabs.locator('li:not(.all) a').first()
			await link.hover()
			await page.waitForTimeout(150)
			await expect(link).toHaveScreenshot(`tabs-posts-hover-${theme}.png`)
		})

		test('selected tab hover', async ({ page }) => {
			const link: Locator = tabs.locator('li a.current')
			await link.hover()
			await page.waitForTimeout(150)
			await expect(link).toHaveScreenshot(`tabs-posts-current-hover-${theme}.png`)
		})

		test('unselected tab focus shows the shadcn ring', async ({ page }) => {
			// Programmatic focus matches `:focus-visible`, painting the shadcn ring on the
			// unselected tab; capture the whole track, since an element shot clips the outer ring.
			const link: Locator = tabs.locator('li:not(.all) a').first()
			await link.focus()
			await page.waitForTimeout(200)
			await expect(tabs).toHaveScreenshot(`tabs-posts-focus-${theme}.png`)
		})
	})
}
