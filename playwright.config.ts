import { defineConfig } from '@playwright/test'
import {
	chromiumProject,
	SHARED_USE,
	setupProject,
} from './tests/visual/support/pw-base'

/**
 * Visual regression config for the Attrium admin theme — FULL-PAGE screen
 * captures (screens.spec.ts). Small-element/component captures (hover/active
 * states that never show in a full-page shot) live in
 * playwright.components.config.ts, which has a tighter pixel budget; both
 * configs must run for the full suite (run-in-docker.sh does this).
 *
 * Screenshots are pixel-sensitive to font antialiasing, which differs between
 * machines. Baselines are COMMITTED to git, so they must always be rendered in
 * the same environment: the official Playwright Docker image (see package.json
 * `test:visual*` scripts and .github/workflows/visual.yml). Running these tests
 * on the host directly will produce spurious diffs.
 *
 * The disposable WordPress under test is provided by `@wordpress/env`
 * (`wp-env start`), which serves the dev instance on http://localhost:8888
 * with a deterministic fresh install (admin / password, default content).
 */
export default defineConfig({
	testDir: './tests/visual',
	// Fail CI if a stray test.only is committed.
	forbidOnly: !!process.env.CI,
	// Screenshots must be deterministic — no retries masking flakiness.
	retries: 0,
	// Serial: a single WP instance with shared state; parallel navigation across
	// admin screens can race on transient admin notices (and the determinism
	// fixtures — e.g. the nav-menu creation in the mu-plugin — are not
	// race-safe), so workers must stay at 1.
	workers: 1,
	reporter: [['html', { open: 'never' }], ['list']],

	expect: {
		toHaveScreenshot: {
			// Per-pixel COLOR distance (YIQ, 0-1) at which a pixel counts as
			// changed. This is not an antialiasing knob — it is a color budget,
			// and it must stay small or the suite goes blind. At the previous
			// 0.2 (also Playwright's default, so it has to be set explicitly), a
			// deliberate regression shifting --attrium-border from oklch(0.922)
			// to oklch(0.86) passed on all 31 screens. At 0.02 the same
			// mutation fails, which is the whole point of the suite. Sub-pixel
			// AA noise is absorbed by maxDiffPixels below, not by this.
			threshold: 0.02,
			// Absolute pixel budget for unavoidable renderer jitter. Deliberately
			// NOT maxDiffPixelRatio: a ratio scales with image area, so on these
			// tall full-screen captures 0.01 meant ~13k freely-changing pixels —
			// the border mutation above produced 15,360 and only barely tripped
			// it. A flat count keeps sensitivity constant across screens of very
			// different heights. (Element-scoped captures use a much smaller
			// budget — see playwright.components.config.ts, where 200 would be
			// ~4.6% of a 118x37 button.)
			maxDiffPixels: 200,
			animations: 'disabled',
			// Hide the text caret and stop scroll position from leaking in.
			caret: 'hide',
			scale: 'css',
		},
	},

	use: SHARED_USE,

	projects: [
		setupProject(),
		chromiumProject({
			// Component specs (tests/visual/components/) are small element
			// captures with their own tighter-budget config; ignore them here so
			// the 200-pixel budget can't silently absorb a real component change.
			testIgnore: /components[/\\].*\.spec\.ts/,
		}),
	],
})
