import { expect, type Locator, type Page, test } from '@playwright/test'
import { applyTheme, stabilize, THEMES, type Theme } from '../support/theme'

/**
 * Popular-tags tag-cloud regression (Featured tab of the plugin installer).
 *
 * `install_dashboard()` renders the "Popular tags" cloud via
 * `wp_generate_tag_cloud()`, which writes an INLINE `font-size: Npt` on every
 * `.tag-cloud-link` (proportional to the tag count) — core paints it as
 * justified running text. `scss/screens/_plugin-install.scss` normalises the
 * links into uniform shadcn-style pill badges sized by the tokens.
 *
 * The cloud is otherwise network-dependent: `install_popular_tags()` calls
 * `plugins_api('hot_tags')` and caches a `poptags_` site transient. The
 * determinism mu-plugin stubs `hot_tags` AND pre-seeds that transient, so the
 * cloud renders the same fixed set in both themes.
 */

async function open(page: Page, theme: Theme): Promise<void> {
	await applyTheme(page, theme)
	await page.goto('/wp-admin/plugin-install.php', { waitUntil: 'domcontentloaded' })
	await stabilize(page)
}

for (const { theme } of THEMES) {
	test.describe(`theme: ${theme}`, () => {
		test('popular tags tag cloud', async ({ page }) => {
			await open(page, theme)
			const cloud: Locator = page.locator(
				'.plugins-popular-tags-wrapper .popular-tags',
			)
			await expect(cloud).toBeVisible()
			await cloud.scrollIntoViewIfNeeded()
			await expect(cloud).toHaveScreenshot(`popular-tags-cloud-${theme}.png`)
		})

		test('popular tags badge', async ({ page }) => {
			await open(page, theme)
			const badge: Locator = page.locator('.popular-tags .tag-cloud-link').first()
			await expect(badge).toBeVisible()
			await badge.scrollIntoViewIfNeeded()
			await expect(badge).toHaveScreenshot(`popular-tags-badge-${theme}.png`)
		})

		test('popular tags badge hover', async ({ page }) => {
			await open(page, theme)
			const badge: Locator = page.locator('.popular-tags .tag-cloud-link').first()
			await expect(badge).toBeVisible()
			await badge.scrollIntoViewIfNeeded()
			await badge.hover()
			await page.waitForTimeout(200)
			await expect(badge).toHaveScreenshot(`popular-tags-badge-hover-${theme}.png`)
		})

		test('popular tags badge focus has no ring', async ({ page }) => {
			// The base state hides nothing: core's `a:focus` box-shadow ring
			// would paint a 2px blue outline. Focus the badge and assert it is
			// replaced by a token border colour (inside the element box, so an
			// element screenshot does not clip it).
			await open(page, theme)
			const badge: Locator = page.locator('.popular-tags .tag-cloud-link').first()
			await expect(badge).toBeVisible()
			await badge.scrollIntoViewIfNeeded()
			await badge.focus()
			await page.waitForTimeout(200)
			await expect(badge).toHaveScreenshot(`popular-tags-badge-focus-${theme}.png`)
		})
	})
}