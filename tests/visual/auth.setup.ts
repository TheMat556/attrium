import { expect, test as setup } from '@playwright/test'
import { AUTH_FILE } from './support/theme'

/**
 * Logs into wp-admin once and persists the session to state.json, which the
 * chromium project reuses for every screen test (no per-page re-login).
 *
 * Credentials are the wp-env defaults (admin / password). Override via env for
 * other environments.
 */
const USER = process.env.WP_ADMIN_USER ?? 'admin'
const PASS = process.env.WP_ADMIN_PASS ?? 'password'

setup('authenticate', async ({ page }) => {
	await page.goto('/wp-login.php')
	await page.fill('#user_login', USER)
	await page.fill('#user_pass', PASS)
	await page.click('#wp-submit')

	// Landing on the dashboard confirms the session cookie is set. We assert on
	// attachment, not visibility: Attrium hides the native admin bar (opacity:0,
	// and the FOUC hider display:none until the shadow host mounts), so
	// toBeVisible() would fail even though the session is valid.
	await page.waitForURL(/wp-admin/)
	await expect(page.locator('#wpadminbar')).toBeAttached()

	await page.context().storageState({ path: AUTH_FILE })
})
