import { expect, type Locator, type Page, test } from '@playwright/test'
import { applyTheme, stabilize, THEMES, type Theme } from '../support/theme'

/**
 * Tabs regression.
 *
 * The `scss/modules/_tabs.scss` module restyles WordPress's `.subsubsub`
 * filter tabs above list tables (All / Published / Trash …) to mirror the
 * shadcn-vue <TabsList>/<TabsTrigger> cva: a `bg-muted` track with an active
 * "card" trigger (`bg-background shadow-sm` in light, `border-input
 * bg-input/30` in dark) and a 3px `:focus-visible` ring. The `.subsubsub` only
 * exists on screens that render list-table views — the posts list is the
 * canonical one with counts on every tab.
 *
 * The triggers are `li > a` inside a floated `ul`; core renders the ` | `
 * separators as raw text nodes in each `<li>`, which the module hides
 * (`li { display: contents }` + zeroed font-size). This spec guards the
 * `.subsubsub`-specific rules (container box, the `li` flattening, the count
 * colour) alongside the hover / focus states.
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
			// Programmatic focus matches `:focus-visible` here, so the shadcn ring
			// (border + 3px box-shadow + 1px outline) paints on the unselected
			// tab. Capture the whole track, not the link element — an element
			// screenshot clips the outer ring.
			const link: Locator = tabs.locator('li:not(.all) a').first()
			await link.focus()
			await page.waitForTimeout(200)
			await expect(tabs).toHaveScreenshot(`tabs-posts-focus-${theme}.png`)
		})
	})
}
