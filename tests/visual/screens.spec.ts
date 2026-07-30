import { expect, test } from '@playwright/test'
import { ADMIN_PAGES } from './pages'
import { applyTheme, snapshotTarget, stabilize, THEMES } from './support/theme'

/**
 * Full-screen visual regression across the restyled wp-admin screens.
 *
 * Each screen is captured in light AND dark mode with Attrium active (the
 * plugin is enabled in the wp-env instance), so the snapshot reflects the real
 * themed output — shell plus embedded WordPress page.
 */

/**
 * Selectors whose content genuinely varies per environment, masked so they
 * don't cause false regressions.
 *
 * Keep this list as SHORT as possible. A Playwright mask paints an opaque
 * magenta box over the element's box, so anything masked is not merely ignored
 * — it is actively removed from coverage, and any theme rule that only affects
 * a masked region becomes unverifiable.
 *
 * Most of what used to live here was masking real UI to paper over a
 * non-deterministic test environment. WordPress was phoning home to wp.org and
 * rendering live update state, so the old list masked `.update-message` (14
 * boxes covering the whole theme-card grid on themes.php, ~152k px), `.subsubsub`
 * (the filter tab bar that `_tabs.scss` styles), `.plugin-card`, `.theme-count`
 * and `#wp-admin-bar-my-account` — which overlays Attrium's OWN header, not the
 * hidden native bar. Those are now handled at the source by
 * `tests/visual/mu-plugins/attrium-visual-determinism.php`, which freezes the
 * update transients and pins post dates, so the screens can be captured intact.
 *
 * Anything added here needs a comment saying why it cannot be pinned instead.
 *
 * With every volatile value pinned at the source, NOTHING needs masking, and the
 * array is empty by design rather than by oversight. For the record:
 *   - `#footer-upgrade` measures 0x0 (Attrium hides the admin footer), so the
 *     mask covered nothing.
 *   - `.wp-version` matched no element on any tested screen.
 *   - `.wp-current-version` on update-core.php IS real (1118x25, "Current
 *     version: 6.7") but its value comes from the `core` pin in `.wp-env.json`,
 *     so it is already deterministic. Masking it painted 27,950 magenta pixels
 *     over styled content for no benefit.
 *   - `td.column-date` was the last candidate — post dates are set at install
 *     time. Masking it cost 37,224 pixels across pages/posts-list, right on the
 *     table styling `_tables.scss` exists to verify. The `afterStart` hook in
 *     `.wp-env.json` pins the dates in the database instead, for 1 line.
 */
const MASKS: string[] = []

for (const { theme } of THEMES) {
	test.describe(`theme: ${theme}`, () => {
		test.beforeEach(async ({ page }) => {
			await applyTheme(page, theme)
		})

		for (const { name, path } of ADMIN_PAGES) {
			test(`screen: ${name}`, async ({ page }) => {
				await page.goto(path, { waitUntil: 'domcontentloaded' })
				await stabilize(page)

				// Grows the viewport and captures #attrium-host, the real
				// scroll container. `fullPage` is a no-op in this app — see
				// `snapshotTarget` for why.
				const target = await snapshotTarget(page)

				await expect(target).toHaveScreenshot(`${name}-${theme}.png`, {
					mask: MASKS.map((s) => page.locator(s)),
				})
			})
		}
	})
}
