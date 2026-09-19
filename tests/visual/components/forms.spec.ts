import { expect, type Locator, test } from '@playwright/test'
import { applyTheme, stabilize, THEMES } from '../support/theme'

/**
 * Form control regression: every `_forms.scss` state (resting/hover/focus/disabled/
 * `aria-invalid`) captured per element. Target: profile.php fields; file/placeholder injected.
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

		test('text input focus', async ({ page }) => {
			const input = page.locator('#first_name')
			await expect(input).toBeVisible()
			await input.scrollIntoViewIfNeeded()
			await input.focus()
			await expect(input).toHaveScreenshot(`form-text-input-focus-${theme}.png`)
		})

		test('text input disabled', async ({ page }) => {
			await page.evaluate(() => {
				document.querySelector('#first_name')?.setAttribute('disabled', '')
			})
			const input = page.locator('#first_name')
			await expect(input).toBeVisible()
			await input.scrollIntoViewIfNeeded()
			await expect(input).toHaveScreenshot(
				`form-text-input-disabled-${theme}.png`,
			)
		})

		test('text input invalid', async ({ page }) => {
			await page.evaluate(() => {
				document
					.querySelector('#first_name')
					?.setAttribute('aria-invalid', 'true')
			})
			const input = page.locator('#first_name')
			await expect(input).toBeVisible()
			await input.scrollIntoViewIfNeeded()
			await expect(input).toHaveScreenshot(
				`form-text-input-invalid-${theme}.png`,
			)
		})

		test('text input invalid focus', async ({ page }) => {
			await page.evaluate(() => {
				document
					.querySelector('#first_name')
					?.setAttribute('aria-invalid', 'true')
			})
			const input = page.locator('#first_name')
			await expect(input).toBeVisible()
			await input.scrollIntoViewIfNeeded()
			await input.focus()
			await expect(input).toHaveScreenshot(
				`form-text-input-invalid-focus-${theme}.png`,
			)
		})

		test('select disabled', async ({ page }) => {
			await page.evaluate(() => {
				document.querySelector('#locale')?.setAttribute('disabled', '')
			})
			const select = page.locator('#locale')
			await expect(select).toBeVisible()
			await select.scrollIntoViewIfNeeded()
			await expect(select).toHaveScreenshot(`form-select-disabled-${theme}.png`)
		})

		test('select invalid', async ({ page }) => {
			await page.evaluate(() => {
				document.querySelector('#locale')?.setAttribute('aria-invalid', 'true')
			})
			const select = page.locator('#locale')
			await expect(select).toBeVisible()
			await select.scrollIntoViewIfNeeded()
			await expect(select).toHaveScreenshot(`form-select-invalid-${theme}.png`)
		})

		test('placeholder', async ({ page }) => {
			// Injected: no profile field carries a placeholder — see header.
			await page.evaluate(() => {
				const input = document.createElement('input')
				input.type = 'text'
				input.placeholder = 'Search'
				input.setAttribute('aria-label', 'injected placeholder probe')
				document.querySelector('#wpcontent')?.appendChild(input)
			})
			const input: Locator = page.locator(
				'input[aria-label="injected placeholder probe"]',
			)
			await expect(input).toBeVisible()
			await input.scrollIntoViewIfNeeded()
			await expect(input).toHaveScreenshot(`form-placeholder-${theme}.png`)
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
