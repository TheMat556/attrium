import { devices, type PlaywrightTestProject } from '@playwright/test'
import { AUTH_FILE } from './theme'

/**
 * Config fragments shared by the two Playwright configs:
 *   - playwright.config.ts            — full-page screen captures (screens.spec.ts)
 *   - playwright.components.config.ts — small element captures (components/*.spec.ts)
 *
 * They differ ONLY in `expect.toHaveScreenshot.maxDiffPixels` (see each config).
 * Everything else must be byte-identical here or committed baselines silently
 * stop matching:
 *   - The viewport bakes into the size of every PNG.
 *   - The chromium project's name and `devices` spread produce the
 *     `-chromium-linux` suffix in the snapshot filename, so renaming the
 *     project or switching devices invalidates every baseline at once.
 */

/** Capture viewport. Declared once and applied in both configs — changing it invalidates every committed baseline. */
export const VIEWPORT = { width: 1440, height: 900 }

/** Options every project shares (project-level `use` overrides these per-project). */
export const SHARED_USE = {
	baseURL: process.env.WP_BASE_URL ?? 'http://localhost:8888',
	viewport: VIEWPORT,
	// wp-env uses a self-signed setup in some configs; harmless for http.
	ignoreHTTPSErrors: true,
	screenshot: 'only-on-failure',
	// NOT 'on-first-retry': retries are 0, so that setting could never produce
	// a trace. Retain on failure so a CI diff is debuggable.
	trace: 'retain-on-failure',
} as const

/** Logs in once and saves the session; every spec reuses it. */
export function setupProject(): PlaywrightTestProject {
	return { name: 'setup', testMatch: /auth\.setup\.ts/ }
}

/**
 * The test project. `testMatch`/`testIgnore` differ per config (each picks up
 * its own half of the suite), so they are passed in; everything else is shared.
 */
export function chromiumProject(
	extra: { testMatch?: RegExp; testIgnore?: RegExp } = {},
): PlaywrightTestProject {
	return {
		name: 'chromium',
		...extra,
		use: {
			...devices['Desktop Chrome'],
			// Must come AFTER the spread and match `use.viewport` above:
			// devices['Desktop Chrome'] carries its own 1280x720 viewport,
			// which would otherwise silently override the top-level value and
			// invalidate every committed baseline. Load-bearing, not redundant.
			viewport: VIEWPORT,
			storageState: AUTH_FILE,
		},
		dependencies: ['setup'],
	}
}
