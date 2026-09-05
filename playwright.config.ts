import { defineConfig, devices } from '@playwright/test'
import { AUTH_FILE } from './tests/visual/support/theme'

/**
 * Visual regression config for the Attrium admin theme.
 *
 * Two projects, one config:
 *   - `screens`    — full-page screen captures (everything outside components/)
 *   - `components` — small element captures (components/*.spec.ts)
 *
 * They differ ONLY in `expect.toHaveScreenshot.maxDiffPixels`, which Playwright
 * accepts per project. This used to be two separate config files that
 * run-in-docker.sh invoked in sequence, with a shared `pw-base.ts` holding the
 * facts that had to stay byte-identical between them. One config with two
 * projects removes that whole failure mode: there is nothing left to keep in
 * sync, and the `setup` dependency is deduplicated so auth runs once instead of
 * once per config.
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
 * Capture viewport. Changing it invalidates every committed baseline — it bakes
 * into the size of every PNG.
 *
 * Set at BOTH the top level and inside each project's `use`: the
 * `devices['Desktop Chrome']` spread carries its own 1280x720 viewport, which
 * would otherwise silently override the top-level value. Load-bearing, not
 * redundant.
 */
const VIEWPORT = { width: 1440, height: 900 }

/**
 * Snapshot filenames, with `-chromium` hardcoded rather than interpolated from
 * `{-projectName}`.
 *
 * Playwright's default template ends in `{-projectName}{-snapshotSuffix}{ext}`,
 * so the 142 committed `*-chromium-linux.png` baselines are named after a
 * project called "chromium". Project names must be unique within a config, so
 * splitting into `screens` + `components` would rename every baseline at once.
 * Pinning the segment here keeps the filenames independent of project naming
 * altogether, which also removes a trap the old two-config setup carried: that
 * renaming a project silently invalidated all baselines.
 */
const SNAPSHOT_PATH_TEMPLATE =
	'{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}-chromium{-platform}{ext}'

/** Screenshot options shared by both projects; only maxDiffPixels differs. */
const SCREENSHOT = {
	// Per-pixel COLOR distance (YIQ, 0-1) at which a pixel counts as changed.
	// This is not an antialiasing knob — it is a color budget, and it must stay
	// small or the suite goes blind. At the previous 0.2 (also Playwright's
	// default, so it has to be set explicitly), a deliberate regression shifting
	// --attrium-border from oklch(0.922) to oklch(0.86) passed on all 31
	// screens. At 0.02 the same mutation fails, which is the whole point of the
	// suite. Sub-pixel AA noise is absorbed by maxDiffPixels, not by this.
	threshold: 0.02,
	animations: 'disabled',
	// Hide the text caret and stop scroll position from leaking in.
	caret: 'hide',
	scale: 'css',
} as const

/** Facts every capture project shares. */
const CAPTURE_PROJECT = {
	use: {
		...devices['Desktop Chrome'],
		// Must come AFTER the spread — see VIEWPORT above.
		viewport: VIEWPORT,
		storageState: AUTH_FILE,
	},
	dependencies: ['setup'],
	snapshotPathTemplate: SNAPSHOT_PATH_TEMPLATE,
}

export default defineConfig({
	testDir: './tests/visual',
	// Fail CI if a stray test.only is committed.
	forbidOnly: !!process.env.CI,
	// Screenshots must be deterministic — no retries masking flakiness.
	retries: 0,

	// Parallel across the single WordPress instance. Verified safe: the suite is
	// read-only apart from the mu-plugin's fixtures, which are seeded once
	// behind an atomic `add_option` claim (see
	// tests/visual/mu-plugins/attrium-visual-determinism.php), and every spec
	// gets its own browser context. A full 137-test run on a freshly destroyed
	// and recreated instance passes at this setting and produces no duplicate
	// fixtures.
	//
	// The count is PINNED, not left to Playwright's default, because the default
	// is wrong here: `os.cpus()` inside the container reports the host's 12
	// hyperthreads rather than the 4 CPUs the container is actually allowed, so
	// the default (50%) resolves to 6 workers on a 4-core box. Measured at 6:
	// tests exceed the 30s timeout and the run fails — and even with the timeout
	// raised it is no faster than 4. Measured wall time for the full suite: 5.2m
	// at 1 worker, 2.7m at 2, 2.0m at 4. `--workers=1` when debugging a race.
	//
	// 4 also matches GitHub's `ubuntu-latest` runner for public repos, so CI and
	// local agree; no CI-conditional value is needed.
	workers: 4,

	// 60s, up from Playwright's 30s default. Each test takes <7s at 4 workers,
	// so this is pure headroom for a loaded machine: with 4 browsers driving one
	// Apache/PHP container, a slow page load must not be reported as a failure
	// that looks like a visual regression. Sized off the observed worst case
	// under deliberate oversubscription (~48s at 6 workers).
	timeout: 60_000,

	reporter: [['html', { open: 'never' }], ['list']],

	expect: { toHaveScreenshot: { ...SCREENSHOT, maxDiffPixels: 200 } },

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
		// Logs in once and saves the session; both capture projects reuse it.
		// Playwright deduplicates a shared dependency, so this runs once.
		{
			name: 'setup',
			testMatch: /auth\.setup\.ts/,
			snapshotPathTemplate: SNAPSHOT_PATH_TEMPLATE,
		},
		{
			...CAPTURE_PROJECT,
			name: 'screens',
			testIgnore: /components[/\\].*\.spec\.ts/,
			expect: {
				toHaveScreenshot: {
					...SCREENSHOT,
					// Absolute pixel budget for unavoidable renderer jitter.
					// Deliberately NOT maxDiffPixelRatio: a ratio scales with
					// image area, so on these tall full-screen captures 0.01
					// meant ~13k freely-changing pixels — the border mutation
					// above produced 15,360 and only barely tripped it. A flat
					// count keeps sensitivity constant across screens of very
					// different heights.
					maxDiffPixels: 200,
				},
			},
		},
		{
			...CAPTURE_PROJECT,
			name: 'components',
			testMatch: /components[/\\].*\.spec\.ts/,
			expect: {
				toHaveScreenshot: {
					...SCREENSHOT,
					// Flat pixel budget for a SMALL image. Same "flat count, not
					// ratio" reasoning as `screens`: an element is only a few
					// thousand pixels, so the screens budget of 200 would be
					// ~4.6% of a 118x37 button. 20 is ~0.46% — tight enough that
					// a real change to the hover/active treatment (thousands of
					// px) or even the 1px border (~300 px) fails, while a few px
					// of sub-pixel AA jitter on the element's edges still
					// passes. Re-check this against the border mutation if you
					// touch it.
					maxDiffPixels: 20,
				},
			},
		},
	],
})
