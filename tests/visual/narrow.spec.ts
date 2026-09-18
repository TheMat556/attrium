import { expect, test } from '@playwright/test'
import { applyTheme, snapshotTarget, stabilize, THEMES } from './support/theme'

/**
 * Narrow-viewport regression (390px): the ≤782px rules no 1440px capture can
 * exercise — upload toolbar stacking, list-table `.toggle-row`, tab wrapping.
 * `snapshotTarget` grows height only, so the narrow width survives.
 */

const NARROW_VIEWPORT = { width: 390, height: 844 }

const NARROW_PAGES = [
	// Media-toolbar stacking + search-field flex rules.
	{ name: 'narrow-upload', path: '/wp-admin/upload.php' },
	// List-table `.toggle-row` caret + tab-track wrapping (bulk-actions row).
	{ name: 'narrow-posts', path: '/wp-admin/edit.php' },
	// Installer filter-links wrapping on the muted track.
	{ name: 'narrow-plugin-install', path: '/wp-admin/plugin-install.php' },
] as const

for (const { theme } of THEMES) {
	test.describe(`theme: ${theme}`, () => {
		for (const { name, path } of NARROW_PAGES) {
			test(name, async ({ page }) => {
				await applyTheme(page, theme)
				await page.setViewportSize(NARROW_VIEWPORT)
				await page.goto(path, { waitUntil: 'domcontentloaded' })
				await stabilize(page)
				const target = await snapshotTarget(page)
				await expect(target).toHaveScreenshot(`${name}-${theme}.png`)
			})
		}
	})
}
