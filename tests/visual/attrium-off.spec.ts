import { expect, test } from '@playwright/test'
import { HOST, stabilize } from './support/theme'

/**
 * Pins ?attrium=off: shell and content reskin stay present or absent together.
 * DOM markers only, no screenshots/baselines.
 */

/**
 * Must not be a native override view (see overrides.ts): no slot renders
 * there, so stabilize() fails.
 */
const PATH = '/wp-admin/plugins.php'
const OFF_PATH = '/wp-admin/plugins.php?attrium=off'

test('control: shell and content reskin are active without the flag', async ({
	page,
}) => {
	await page.goto(PATH, { waitUntil: 'networkidle' })
	await stabilize(page)

	// Shell mounted and took #wpcontent.
	await expect(page.locator(HOST)).toBeAttached()
	await expect(page.locator(`${HOST} > #wpcontent`)).toBeAttached()
	await expect(page.locator('#attrium-data')).toBeAttached()
	await expect(page.locator('#attrium-overlay-css')).toBeAttached()

	// Content reskin active.
	const bodyClasses = await page.evaluate(() => document.body.className)
	expect(bodyClasses).toMatch(/attrium-mod-/)

	const themeChunks = await page.evaluate(
		() => document.querySelectorAll('link[href*="admin-theme-"]').length,
	)
	expect(themeChunks).toBeGreaterThan(0)
})

test('?attrium=off disables the shell and the content reskin', async ({
	page,
}) => {
	await page.goto(OFF_PATH, { waitUntil: 'networkidle' })

	// No shell here, so stabilize() cannot run; networkidle + fonts.ready
	// is the settle signal.
	await page.locator('#wpadminbar').waitFor({ state: 'attached' })
	await page.evaluate(() => document.fonts.ready)

	// Shell markers absent (auto-retry covers slow mount).
	await expect(page.locator(HOST)).not.toBeAttached()
	await expect(page.locator('#attrium-body-hider')).not.toBeAttached()
	await expect(page.locator('#attrium-overlay-css')).not.toBeAttached()
	await expect(page.locator('#attrium-data')).not.toBeAttached()

	// Stock content stays put.
	await expect(page.locator('#wpcontent')).toBeAttached()

	// No content reskin markers.
	const bodyClasses = await page.evaluate(() => document.body.className)
	expect(bodyClasses).not.toContain('attrium-booting')
	expect(bodyClasses).not.toMatch(/attrium-mod-/)

	await expect(page.locator('link[href*="admin-theme-"]')).toHaveCount(0)
})
