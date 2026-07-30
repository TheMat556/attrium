import { defineConfig, devices } from '@playwright/test'
import { AUTH_FILE } from './tests/visual/support/theme'

/**
 * Visual regression config for the Attrium admin theme.
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
/**
 * Capture viewport. Declared once and applied in two places (see `projects`) —
 * changing it invalidates every committed baseline.
 */
const VIEWPORT = { width: 1440, height: 900 }

export default defineConfig({
	testDir: './tests/visual',
	// Fail CI if a stray test.only is committed.
	forbidOnly: !!process.env.CI,
	// Screenshots must be deterministic — no retries masking flakiness.
	retries: 0,
	// Serial: a single WP instance with shared state; parallel navigation across
	// admin screens can race on transient admin notices.
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
			// different heights.
			maxDiffPixels: 200,
			animations: 'disabled',
			// Hide the text caret and stop scroll position from leaking in.
			caret: 'hide',
			scale: 'css',
		},
	},

	use: {
		baseURL: process.env.WP_BASE_URL ?? 'http://localhost:8888',
		viewport: VIEWPORT,
		// wp-env uses a self-signed setup in some configs; harmless for http.
		ignoreHTTPSErrors: true,
		screenshot: 'only-on-failure',
		// NOT 'on-first-retry': retries are 0, so that setting could never
		// produce a trace. Retain on failure so a CI diff is debuggable.
		trace: 'retain-on-failure',
	},

	projects: [
		// Logs in once and saves the session; every spec reuses it.
		{ name: 'setup', testMatch: /auth\.setup\.ts/ },
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				// Must come AFTER the spread and match `use.viewport` above:
				// devices['Desktop Chrome'] carries its own 1280x720 viewport,
				// which would otherwise silently override the top-level value
				// and invalidate every committed baseline. Load-bearing, not
				// redundant.
				viewport: VIEWPORT,
				storageState: AUTH_FILE,
			},
			dependencies: ['setup'],
		},
	],
})
