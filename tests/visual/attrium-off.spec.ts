import { expect, test } from '@playwright/test'
import { HOST, stabilize } from './support/theme'

/**
 * Pins the ?attrium=off kill switch to both surfaces it must disable.
 *
 * The shell (`Attrium`) and the wp-body content reskin (`ModuleRegistry`:
 * admin-theme-*.css chunks plus attrium-mod-* body classes) share a single
 * owner for the flag (`Settings::is_disabled_by_query()`). This spec proves
 * they stay present or absent together: without the flag both are active,
 * with ?attrium=off both are gone.
 *
 * Regression cover: the flag used to bail only the shell, so the content
 * reskin still loaded and the page rendered half-themed. A test asserting
 * only the shell would have stayed green through that bug.
 *
 * No screenshots here — this reads DOM markers directly, so it adds no
 * baselines and cannot break on a legitimate restyle.
 */

/**
 * A regular admin screen for both legs.
 *
 * Must NOT be one of the screens Attrium replaces with a native Vue view
 * (see src/views/overrides.ts): on those no wp-content slot renders and
 * #wpcontent is never reparented, so stabilize()'s mount assertion fails.
 * plugins.php is in pages.ts, so it is already known to work with it.
 */
const PATH = '/wp-admin/plugins.php'
const OFF_PATH = '/wp-admin/plugins.php?attrium=off'

test('control: shell and content reskin are active without the flag', async ({
	page,
}) => {
	await page.goto(PATH, { waitUntil: 'networkidle' })
	await stabilize(page)

	// Shell mounted and swallowed the WordPress content.
	await expect(page.locator(HOST)).toBeAttached()
	await expect(page.locator(`${HOST} > #wpcontent`)).toBeAttached()
	await expect(page.locator('#attrium-data')).toBeAttached()
	await expect(page.locator('#attrium-overlay-css')).toBeAttached()

	// Content reskin active: module body classes plus per-topic CSS chunks.
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

	// Settle signal for the stock admin: the shell never mounts here, so
	// stabilize()'s hider assertion cannot run. networkidle above covers the
	// bundle load window, and fonts.ready covers the remaining async settle —
	// if the shell were going to mount, it had its chance by now.
	await page.locator('#wpadminbar').waitFor({ state: 'attached' })
	await page.evaluate(() => document.fonts.ready)

	// Shell markers: all absent. The locators auto-retry, so a slow mount
	// cannot slip through as a false pass.
	await expect(page.locator(HOST)).not.toBeAttached()
	await expect(page.locator('#attrium-body-hider')).not.toBeAttached()
	await expect(page.locator('#attrium-overlay-css')).not.toBeAttached()
	await expect(page.locator('#attrium-data')).not.toBeAttached()

	// Stock content stays where core put it instead of moving into the host.
	await expect(page.locator('#wpcontent')).toBeAttached()

	// Content reskin markers: no module classes, no booting class, no
	// per-topic CSS chunks.
	const bodyClasses = await page.evaluate(() => document.body.className)
	expect(bodyClasses).not.toContain('attrium-booting')
	expect(bodyClasses).not.toMatch(/attrium-mod-/)

	await expect(page.locator('link[href*="admin-theme-"]')).toHaveCount(0)
})
