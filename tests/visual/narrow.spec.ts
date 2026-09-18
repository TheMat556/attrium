import { expect, test } from '@playwright/test'
import { applyTheme, snapshotTarget, stabilize, THEMES } from './support/theme'

/**
 * Narrow-viewport regression (≤782px).
 *
 * Every other capture runs at 1440px, so the mobile-only rules never render
 * under test: the upload media-toolbar stacking (`scss/screens/_upload.scss`),
 * the tab-track/trigger wrapping (`scss/ui/_primitives.scss` tabs-track,
 * tabs-trigger, underline-tabs), and the list-table `.toggle-row` expand
 * caret (`scss/modules/_tables.scss`, which core itself hides above 782px).
 * Those rules previously carried green audit verdicts the suite could not
 * have produced — this spec is the evidence.
 *
 * Each page is captured full-height at a 390px viewport (the shared
 * `snapshotTarget` grows height only, so the narrow width — and the media
 * queries — survive). Light AND dark, like everything else.
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
