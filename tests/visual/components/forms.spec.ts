import { expect, type Locator, test } from '@playwright/test'
import { applyTheme, stabilize, THEMES } from '../support/theme'

/**
 * Form control regression.
 *
 * The `scss/modules/_forms.scss` mixins restyle WordPress admin form controls
 * (text inputs, textareas, selects, and file inputs). Unlike buttons there is
 * no interaction state worth capturing, so we snapshot each control element on
 * its own in light AND dark mode.
 *
 * Target: profile.php — a real, side-effect-free screen carrying every control
 * the module styles: text input (`#first_name`), textarea (`#description`),
 * and select (`#locale`). The file input is not present on any reachable core
 * screen, so it is injected into the DOM for capture (the selector
 * `input[type="file"]` is what the module gates on).
 */

for (const { theme } of THEMES) {
	test.describe(`theme: ${theme}`, () => {
		test.beforeEach(async ({ page }) => {
			await applyTheme(page, theme)
			await page.goto('/wp-admin/profile.php', {
				waitUntil: 'domcontentloaded',
			})
			await stabilize(page)
		})

		test('text input', async ({ page }) => {
			const input = page.locator('#first_name')
			await expect(input).toBeVisible()
			await input.scrollIntoViewIfNeeded()
			await expect(input).toHaveScreenshot(`form-text-input-${theme}.png`)
		})

		test('textarea', async ({ page }) => {
			const textarea = page.locator('#description')
			await expect(textarea).toBeVisible()
			await textarea.scrollIntoViewIfNeeded()
			await expect(textarea).toHaveScreenshot(`form-textarea-${theme}.png`)
		})

		test('select', async ({ page }) => {
			const select = page.locator('#locale')
			await expect(select).toBeVisible()
			await select.scrollIntoViewIfNeeded()
			await expect(select).toHaveScreenshot(`form-select-${theme}.png`)
		})

		test('select hover', async ({ page }) => {
			const select = page.locator('#locale')
			await expect(select).toBeVisible()
			await select.scrollIntoViewIfNeeded()
			await select.hover()
			await expect(select).toHaveScreenshot(`form-select-hover-${theme}.png`)
		})

		test('select focus', async ({ page }) => {
			const select = page.locator('#locale')
			await expect(select).toBeVisible()
			await select.scrollIntoViewIfNeeded()
			await select.focus()
			await expect(select).toHaveScreenshot(`form-select-focus-${theme}.png`)
		})

		test('file input', async ({ page }) => {
			// Injected, not present on a core screen — see header comment.
			await page.evaluate(() => {
				const input = document.createElement('input')
				input.type = 'file'
				document.querySelector('#wpcontent')?.appendChild(input)
			})
			const file: Locator = page.locator('input[type="file"]')
			await expect(file).toBeVisible()
			await file.scrollIntoViewIfNeeded()
			await expect(file).toHaveScreenshot(`form-file-${theme}.png`)
		})
	})
}
