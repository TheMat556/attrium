import { expect, type Locator, type Page, test } from '@playwright/test'
import { applyTheme, stabilize, THEMES, type Theme } from '../support/theme'

/**
 * Screen Options + contextual Help panel regression.
 *
 * The `scss/modules/_screen-meta.scss` module restyles the `#screen-meta`
 * panels: an elevated surface card (token border + radius) whose Help side
 * splits into a gray tabs rail (the shadcn-style vertical TabsList) and a
 * content column separated by 1px left/right borders, plus the Screen Options
 * form. The panels only render after WP's `screenMeta` toggles them open
 * (jQuery slideDown), so they never show in a static full-page shot — hence
 * element captures here.
 *
 * Target: the Pages list (edit.php?post_type=page), which ships both help
 * tabs ("Overview", "Managing Pages"), a help sidebar, and the Columns +
 * Pagination screen options.
 */

async function open(page: Page, theme: Theme, path: string): Promise<void> {
	await applyTheme(page, theme)
	await page.goto(path, { waitUntil: 'domcontentloaded' })
	await stabilize(page)
}

/**
 * Open a screen-meta panel by clicking its hidden toggle link, the same way
 * the header BookOpen dropdown (useScreenMeta) does. `#screen-meta-links` is
 * `display: none`, but a programmatic click still fires the jQuery
 * `screenMeta.toggleEvent` handler core binds to `.show-settings`.
 */
async function openPanel(
	page: Page,
	linkId: string,
	wrapId: string,
): Promise<Locator> {
	await page.evaluate((id) => {
		document.getElementById(id)?.click()
	}, linkId)
	// jQuery slideDown runs on its own timer; core only removes the `.hidden`
	// class in the animation's completion callback, so its absence means the
	// panel is fully open — no fixed sleep needed.
	await page.waitForFunction((id) => {
		const wrap = document.getElementById(id)
		return wrap !== null && !wrap.classList.contains('hidden')
	}, wrapId)
	return page.locator('#screen-meta')
}

for (const { theme } of THEMES) {
	test.describe(`theme: ${theme}`, () => {
		test('help panel', async ({ page }) => {
			await open(page, theme, '/wp-admin/edit.php?post_type=page')
			const panel = await openPanel(
				page,
				'contextual-help-link',
				'contextual-help-wrap',
			)
			await panel.scrollIntoViewIfNeeded()
			await expect(panel).toHaveScreenshot(`screen-meta-help-${theme}.png`)
		})

		test('help tab hover', async ({ page }) => {
			await open(page, theme, '/wp-admin/edit.php?post_type=page')
			await openPanel(page, 'contextual-help-link', 'contextual-help-wrap')
			const tab = page.locator('#tab-link-managing-pages a')
			await expect(tab).toBeVisible()
			await tab.scrollIntoViewIfNeeded()
			await tab.hover()
			await expect(tab).toHaveScreenshot(`screen-meta-help-hover-${theme}.png`)
		})

		test('screen options panel', async ({ page }) => {
			await open(page, theme, '/wp-admin/edit.php?post_type=page')
			const panel = await openPanel(
				page,
				'show-settings-link',
				'screen-options-wrap',
			)
			await panel.scrollIntoViewIfNeeded()
			await expect(panel).toHaveScreenshot(`screen-meta-options-${theme}.png`)
		})
	})
}
