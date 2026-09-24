import { expect, test } from '@playwright/test'
import { applyTheme, stabilize, THEMES } from './support/theme'

/**
 * Mobile navigation drawer, open (390px): the modal Sheet + overlay engage
 * reka-ui's body scroll-lock, so this is the only capture of the shell in that
 * state — it guards the dark-mode card-corner compositing this repo regressed on.
 */

const NARROW_VIEWPORT = { width: 390, height: 844 }

for (const { theme } of THEMES) {
	test(`mobile sidebar drawer ${theme}`, async ({ page }) => {
		await applyTheme(page, theme)
		await page.setViewportSize(NARROW_VIEWPORT)
		await page.goto('/wp-admin/edit.php', { waitUntil: 'domcontentloaded' })
		await stabilize(page)

		await page.locator('[data-slot="sidebar-trigger"]').click()
		// The drawer is a reka-ui portal in the host's shadow root; match it on
		// its accessible name and capture the viewport so no DOM-position
		// assumption can silently drop it from the shot.
		await expect(page.getByRole('dialog', { name: 'Sidebar' })).toBeVisible()

		await expect(page).toHaveScreenshot(`sidebar-mobile-open-${theme}.png`)
	})
}
