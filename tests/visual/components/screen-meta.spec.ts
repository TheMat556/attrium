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
 * Target: the Pages list (edit.php?post_type=page), which ships help tabs, a
 * help sidebar, and the Columns + Pagination screen options.
 *
 * The header BookOpen dropdown (SiteHeader.vue + useScreenMeta) is the new
 * user-facing entry point: it opens the same panels by clicking the hidden
 * toggle links. The last test drives that real path (trigger → menu item) so
 * the dropdown's own markup and click wiring are covered, not just the panels.
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
	await waitForPanelOpen(page, wrapId)
	return page.locator('#screen-meta')
}

/** Wait for a panel's jQuery slideDown to finish (`.hidden` removed on complete). */
async function waitForPanelOpen(page: Page, wrapId: string): Promise<void> {
	await page.waitForFunction((id) => {
		const wrap = document.getElementById(id)
		return wrap !== null && !wrap.classList.contains('hidden')
	}, wrapId)
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

		test('header dropdown opens both panels', async ({ page }) => {
			await open(page, theme, '/wp-admin/edit.php?post_type=page')

			// The trigger only renders once useScreenMeta detects the panels in
			// the embedded page, so its presence is part of the assertion.
			const trigger = page.getByRole('button', {
				name: 'Screen options and help',
			})
			await expect(trigger).toBeVisible()

			await trigger.click()
			// Scoped by name: WP's admin-bar <ul role="menu"> elements are also
			// on the page, so an unscoped getByRole('menu') is ambiguous. The
			// reka-ui menu's aria-labelledby points at the trigger, giving it
			// the same accessible name as the button.
			const menu = page.getByRole('menu', { name: 'Screen options and help' })
			await expect(menu).toBeVisible()
			await expect(
				menu.getByRole('menuitem', { name: 'Screen Options' }),
			).toBeVisible()
			await expect(menu.getByRole('menuitem', { name: 'Help' })).toBeVisible()
			await expect(menu).toHaveScreenshot(
				`screen-meta-dropdown-${theme}.png`,
			)

			await menu.getByRole('menuitem', { name: 'Screen Options' }).click()
			await waitForPanelOpen(page, 'screen-options-wrap')
			await expect(page.locator('#screen-options-wrap')).toBeVisible()

			// Reopen for the Help entry (selecting closes the menu).
			await trigger.click()
			await page
				.getByRole('menu', { name: 'Screen options and help' })
				.getByRole('menuitem', { name: 'Help' })
				.click()
			await waitForPanelOpen(page, 'contextual-help-wrap')
			await expect(page.locator('#contextual-help-wrap')).toBeVisible()
		})
	})
}
