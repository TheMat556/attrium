import { defineConfig } from '@playwright/test'
import {
	chromiumProject,
	SHARED_USE,
	setupProject,
} from './tests/visual/support/pw-base'

/**
 * Visual regression config for COMPONENT (small-element) captures — specs
 * under tests/visual/components/ (buttons.spec.ts, and future tables/selects/
 * tabs specs). These snapshot an element on its own, so the full-page config's
 * `maxDiffPixels: 200` is far too lax here: a 118x37 button is 4,366 px, so 200
 * would let 4.6% of the element change without failing. Every spec in this
 * config gets the tight budget automatically — no per-call ceremony.
 *
 * Shared facts (viewport, chromium project, auth) live in
 * tests/visual/support/pw-base.ts and must match playwright.config.ts exactly,
 * or the committed `-chromium-linux` baselines silently stop matching. The ONLY
 * deliberate difference from that config is `expect.toHaveScreenshot.maxDiffPixels`
 * (and the report/output dirs, so the two runs don't clobber each other).
 */
export default defineConfig({
	testDir: './tests/visual',
	// Fail CI if a stray test.only is committed.
	forbidOnly: !!process.env.CI,
	// Screenshots must be deterministic — no retries masking flakiness.
	retries: 0,
	// Serial: a single WP instance with shared state.
	workers: 1,
	reporter: [
		// Own HTML report; run-in-docker.sh runs both configs, so without a
		// distinct folder the two reports would overwrite each other.
		['html', { open: 'never', outputFolder: 'playwright-report-components' }],
		['list'],
	],
	outputDir: 'test-results-components',

	expect: {
		toHaveScreenshot: {
			// Same per-pixel color budget as the full-page suite (see
			// playwright.config.ts for why 0.02 is load-bearing).
			threshold: 0.02,
			// Flat pixel budget for a SMALL image. Same "flat count, not ratio"
			// reasoning as the full-page suite: an element is only a few thousand
			// pixels, so 20 is ~0.46% of the primary button — tight enough that
			// a real change to the hover/active treatment (thousands of px) or
			// even the 1px border (~300 px) fails, while a few px of sub-pixel
			// AA jitter on the element's edges still passes. Re-check this value
			// against the border mutation if you touch it.
			maxDiffPixels: 20,
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
			// Only the element-scoped specs under tests/visual/components/.
			testMatch: /components[/\\].*\.spec\.ts/,
		}),
	],
})
