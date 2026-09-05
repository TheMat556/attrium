import { expect, type Page, test } from '@playwright/test'
import {
	applyTheme,
	freezeAnimations,
	growViewportToFit,
	THEMES,
} from './support/theme'

/**
 * Customizer visual regression.
 *
 * customize.php is an overlay screen — `Attrium::is_overlay_screen()` keeps
 * the Vue shell (and its `#attrium-host`) off the page entirely, so the shared
 * `stabilize()` / `snapshotTarget()` helpers cannot run here: there is no host
 * to attach and no `#wpcontent` to reparent. Theme-awareness still works,
 * though — the resolver `Attrium\Utility\Theme` (admin/src/Utility/Theme.php)
 * prints the same pre-paint script here as on every admin page, reading the
 * `attrium-theme` localStorage key and toggling `html.attrium-dark`, so
 * `applyTheme()` drives light/dark exactly as it does for the shell.
 *
 * Captures target the sidebar (`#customize-controls`) — the surface the
 * `scss/screens/_customize*.scss` reskin covers. The preview pane (the live
 * site iframe) is deliberately excluded: it renders the front page, which is
 * outside the theme work and would import site-content determinism into the
 * suite.
 *
 * Views under test (the accordion list plus the nested sub-panes):
 *   - `customize`              — the main accordion list (default load),
 *   - `customize-section`      — an open section sub-pane (Site Identity) via
 *                                autofocus[section]=title_tagline,
 *   - `customize-menus-panel`  — the open Menus panel (back button, panel
 *                                title, menu sub-sections) via
 *                                autofocus[panel]=nav_menus,
 *   - `customize-homepage-settings` — the Homepage Settings section via
 *                                autofocus[section]=static_front_page,
 *   - `customize-additional-css` — the Additional CSS section via
 *                                autofocus[section]=custom_css,
 *   - `customize-mobile`       — the main list at a ≤640px viewport, where the
 *                                Customize/Preview toggle and the flexed
 *                                header actions bar render.
 */

const CUSTOMIZER = '/wp-admin/customize.php'

/**
 * Wait for the Customizer's client JS to finish building the sidebar:
 * `body.ready` is added when the API initializes, and the accordion sections
 * are rendered into `.customize-pane-parent` after that. For the autofocus
 * views, also wait for the nested pane to actually open. Then neutralize
 * animations/transitions/caret like `stabilize()` does (no shadow root here,
 * so the injected style tag reaches everything).
 */
async function settleCustomizer(
	page: Page,
	expectOpenPane = false,
): Promise<void> {
	await page.waitForFunction(() => document.body.classList.contains('ready'))
	// `attached`, not visible: the pane-parent also contains the outer
	// sections (e.g. publish-settings), which core renders display:none, and on
	// the sub-pane views the whole parent is hidden while the child pane
	// slides in — so visibility is the wrong signal; existence is the render
	// signal. The open-pane wait below covers the visible content.
	await page.waitForSelector(
		'#customize-theme-controls .customize-pane-parent .control-section',
		{ state: 'attached' },
	)
	if (expectOpenPane) {
		// Sections mark their opened pane with `.open`, panels with
		// `.current-panel` (see customize-controls.js Panel.onChangeExpanded);
		// the closed panes are visibility:hidden, so only the active one
		// matches a visible wait.
		await page.waitForSelector(
			'#customize-theme-controls .customize-pane-child.open,' +
				'#customize-theme-controls .customize-pane-child.current-panel',
		)
	}

	await page.evaluate(async () => {
		await document.fonts.ready
	})

	// Diagnostic guards, in the same spirit as `stabilize()`'s shell
	// assertion: a green suite must not hide a dead reskin. `attrium-mod-screens`
	// is the gate every scss/screens/_customize-*.scss rule hangs off (applied
	// by CustomizerSupport's footer inline script), and the Inter Variable
	// check asserts the @font-face now arrives via the enqueued build
	// stylesheet. Either failing would otherwise surface only as an unexplained
	// pixel diff.
	await expect(page.locator('body')).toHaveClass(/attrium-mod-screens/)
	await expect
		.poll(() =>
			page.evaluate(() => document.fonts.check('16px "Inter Variable"')),
		)
		.toBe(true)

	// No shadow root here, so the document-level freeze reaches everything.
	await freezeAnimations(page)
}

/**
 * Grow the viewport until the whole sidebar content is visible, mirroring
 * `snapshotTarget()`: the overlay is fixed/absolute (the document never
 * scrolls), so the content must be revealed by growing the viewport. The
 * sidebar's scroll container is `.wp-full-overlay-sidebar-content`.
 */
async function growSidebarToFit(page: Page): Promise<void> {
	const sidebar = page.locator('#customize-controls')
	const measure = () =>
		sidebar.evaluate((el) => {
			const scroller = el.querySelector('.wp-full-overlay-sidebar-content')
			if (!scroller) return 0
			const rect = el.getBoundingClientRect()
			const scr = scroller.getBoundingClientRect()
			return (
				scroller.scrollHeight +
				(scr.top - rect.top) +
				(rect.bottom - scr.bottom)
			)
		})

	await growViewportToFit(page, measure, 'customizer')
}

/** The desktop views, each captured in light AND dark. */
const DESKTOP_VIEWS = [
	{ name: 'customize', path: CUSTOMIZER, pane: false },
	{
		name: 'customize-section',
		path: `${CUSTOMIZER}?autofocus[section]=title_tagline`,
		pane: true,
	},
	{
		name: 'customize-menus-panel',
		path: `${CUSTOMIZER}?autofocus[panel]=nav_menus`,
		pane: true,
	},
	{
		name: 'customize-homepage-settings',
		path: `${CUSTOMIZER}?autofocus[section]=static_front_page`,
		pane: true,
	},
	{
		name: 'customize-additional-css',
		path: `${CUSTOMIZER}?autofocus[section]=custom_css`,
		pane: true,
	},
] as const

for (const { theme } of THEMES) {
	test.describe(`theme: ${theme}`, () => {
		test.beforeEach(async ({ page }) => {
			await applyTheme(page, theme)
		})

		for (const view of DESKTOP_VIEWS) {
			test(`customizer: ${view.name}`, async ({ page }) => {
				await page.goto(view.path, { waitUntil: 'networkidle' })
				await settleCustomizer(page, view.pane)
				await growSidebarToFit(page)

				await expect(page.locator('#customize-controls')).toHaveScreenshot(
					`${view.name}-${theme}.png`,
				)
			})
		}
	})
}

// The Customize/Preview toggle and the flexed header actions bar only render
// at ≤640px, so the mobile viewport gets its own captures of the main list.
test.describe('customizer: mobile', () => {
	for (const { theme } of THEMES) {
		test(`theme: ${theme}`, async ({ page }) => {
			await applyTheme(page, theme)
			await page.setViewportSize({ width: 640, height: 900 })
			await page.goto(CUSTOMIZER, { waitUntil: 'networkidle' })
			await settleCustomizer(page)
			await growSidebarToFit(page)

			await expect(page.locator('#customize-controls')).toHaveScreenshot(
				`customize-mobile-${theme}.png`,
			)
		})
	}
})
