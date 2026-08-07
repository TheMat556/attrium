import { expect, type Locator, type Page, test } from '@playwright/test'
import { applyTheme, stabilize, THEMES, type Theme } from '../support/theme'

/**
 * Theme-installer regression.
 *
 * `scss/screens/_theme-install.scss` reskins the Add Themes screen: the
 * `.wp-filter` toolbar (Popular/Latest tabs + search, via the shared
 * `filter-toolbar` / `field-outline` mixins), the count badge, the
 * `.filter-drawer` feature-filter panel (`ui.filter-drawer`), and the
 * `.wp-upload-form` upload card.
 *
 * The `.filter-drawer` is `display:none` until the toolbar's "Feature Filter"
 * button adds `show-filters` to `.wp-filter`, so this spec pins the drawer
 * (surface, filter-group cards, Apply Clear actions) by revealing it the same
 * way core does before screenshotting. Together with the plugin-installer spec
 * this also covers `ui.filter-drawer`, the mixin shared by both installers.
 */

async function openWithFilters(page: Page, theme: Theme): Promise<void> {
	await applyTheme(page, theme)
	await page.goto('/wp-admin/theme-install.php', { waitUntil: 'domcontentloaded' })
	await stabilize(page)
	await page.evaluate(() => {
		// Mirror core's drawer reveal: the "Feature Filter" button toggles the
		// `show-filters` class on `.wp-filter`.
		document.querySelector<HTMLElement>('.wp-filter')?.classList.add('show-filters')
	})
	await page.waitForTimeout(200)
}

for (const { theme } of THEMES) {
	test.describe(`theme: ${theme}`, () => {
		test('feature-filter drawer', async ({ page }) => {
			await openWithFilters(page, theme)
			const drawer: Locator = page.locator('.filter-drawer')
			await expect(drawer).toBeVisible()
			await drawer.scrollIntoViewIfNeeded()
			await expect(drawer).toHaveScreenshot(`theme-install-drawer-${theme}.png`)
		})

		test('filter checkboxes sit beside their labels', async ({ page }) => {
			await openWithFilters(page, theme)
			const rows: Locator = page.locator('.filter-group-feature')
			await expect(rows.first()).toBeVisible()
			const rowCount: number = await rows.count()
			expect(rowCount).toBeGreaterThan(0)
			for (let i = 0; i < rowCount; i++) {
				const row = rows.nth(i)
				const input: Locator = row.locator('input[type="checkbox"]').first()
				const label: Locator = row.locator('label').first()
				const inputBox = (await input.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 }
				const labelBox = (await label.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 }
				// Same visual row: the label's top must fall inside the box's
				// vertical span — this is what the `position: absolute` on
				// drawer inputs (`ui.filter-drawer`) guarantees.
				expect(labelBox.y < inputBox.y + inputBox.height).toBeTruthy()
				expect(labelBox.y + labelBox.height > inputBox.y).toBeTruthy()
			}
		})
	})
}