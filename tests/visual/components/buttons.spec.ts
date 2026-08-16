import { expect, type Locator, test } from '@playwright/test'
import { applyTheme, stabilize, THEMES } from '../support/theme'

/**
 * Button interaction-state regression.
 *
 * The `scss/modules/_buttons.scss` mixins restyle WordPress admin buttons and
 * define distinct hover (brightness) and active (translateY press) treatments.
 * Those states never appear in a static full-page screenshot, so we capture the
 * button element on its own in each state.
 *
 * Target: the "Update Profile" primary submit on profile.php — always present,
 * a real `.button.button-primary`, and reached without side effects.
 *
 * Each state is captured in light AND dark mode.
 */

for (const { theme } of THEMES) {
	test.describe(`theme: ${theme}`, () => {
		let button: Locator

		test.beforeEach(async ({ page }) => {
			await applyTheme(page, theme)
			await page.goto('/wp-admin/profile.php', {
				waitUntil: 'domcontentloaded',
			})
			await stabilize(page)
			button = page.locator('#submit')
			await expect(button).toBeVisible()
			await button.scrollIntoViewIfNeeded()
		})

		test('normal', async () => {
			// No per-call options: the tight maxDiffPixels for element captures
			// comes from the components config (playwright.components.config.ts).
			await expect(button).toHaveScreenshot(
				`button-primary-normal-${theme}.png`,
			)
		})

		test('hover', async () => {
			await button.hover()
			// toHaveScreenshot waits for two stable frames, so no fixed sleep is
			// needed for the hover treatment to settle.
			await expect(button).toHaveScreenshot(`button-primary-hover-${theme}.png`)
		})

		test('active', async ({ page }) => {
			// Simulate :active by holding the mouse button down over the element.
			const box = await button.boundingBox()
			if (!box) throw new Error('button has no bounding box')
			await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
			await page.mouse.down()
			try {
				await expect(button).toHaveScreenshot(
					`button-primary-active-${theme}.png`,
				)
			} finally {
				// Release without triggering the form submit: move off-target first.
				await page.mouse.move(0, 0)
				await page.mouse.up()
			}
		})
	})
}
