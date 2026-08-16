import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Shared visual-regression helpers.
 *
 * Both specs (`screens.spec.ts`, `buttons.spec.ts`) parametrize over light/dark
 * and need the same page-settle logic, so it lives here in one place rather
 * than being copy-pasted (and drifting) per spec.
 */

/** The two theme variants every screen is captured in. */
export const THEMES = [{ theme: 'light' }, { theme: 'dark' }] as const
export type Theme = (typeof THEMES)[number]['theme']

/**
 * Persisted auth state written by `auth.setup.ts` and consumed by the
 * `chromium` project in `playwright.config.ts`. Kept here so both reference the
 * same literal.
 */
export const AUTH_FILE = 'tests/visual/.auth/state.json'

/**
 * The shadow host created by `src/main.ts`. It is `position: fixed; inset: 0`
 * with `overflow-y: auto`, so IT is the scrolling element — not the document.
 * That makes it both the capture target (see `snapshotTarget`) and the element
 * carrying the `dark` class.
 */
export const HOST = '#attrium-host'

/**
 * Seed the theme before the page's own scripts run.
 *
 * Attrium is NOT driven by `prefers-color-scheme`: `useTheme.ts` reads the
 * `attrium-theme` localStorage key and `main.ts` applies the `dark` class to
 * `#attrium-host` at boot, BEFORE Vue mounts. So the value has to be seeded via
 * an init script (runs before page scripts on every navigation), not by
 * emulating the media feature.
 *
 * BOTH variants are seeded explicitly. Writing only the dark key and treating
 * "no key" as light is wrong: `useColorMode` defaults to `auto`, which follows
 * the OS preference — so on a machine (or container) reporting a dark
 * preference, the "light" tests silently render dark and match the wrong
 * baseline. Verified: with `colorScheme: 'dark'` emulated and no seed, the host
 * came up with the `dark` class applied.
 */
export async function applyTheme(page: Page, theme: Theme): Promise<void> {
	await page.addInitScript((value) => {
		localStorage.setItem('attrium-theme', value)
	}, theme)
}

/**
 * Wait for the page to be visually settled, then assert Attrium actually
 * mounted, before snapshotting:
 *   1. Attrium's FOUC hider (#attrium-body-hider) is removed by main.ts only
 *      after the Vue shell has mounted and projected the wp-content slot, so
 *      its absence is the signal that the themed layout is in place.
 *   2. The shell really is present, and WordPress's #wpcontent was reparented
 *      into it (the light-DOM slot move that is the plugin's core trick).
 *   3. Web fonts are loaded (Inter) — otherwise text reflows mid-capture.
 *   4. Animations/transitions/carets are neutralized so hover/focus states and
 *      the sidebar don't produce sub-pixel diffs.
 *
 * Step 2 is load-bearing, not belt-and-braces. Previously this helper swallowed
 * a missing hider ("Attrium may be disabled on this screen"), which meant a
 * screen that failed to render at all still produced a green snapshot: the
 * Menus baseline captured a WordPress 500 error page ("Your theme does not
 * support navigation menus") for both themes, and `_nav-menus.scss` had zero
 * real coverage while the suite reported success. Asserting the mount turns
 * that class of failure loud. Screens where Attrium is intentionally inactive
 * (block/site editor, customizer — see `Attrium::is_overlay_screen()`) are not
 * in `ADMIN_PAGES`; if one is ever added, it needs its own capture path rather
 * than a silent catch here.
 *
 * Note on (4): `addStyleTag` injects into the document, which covers the
 * embedded WordPress page (`#wpcontent`, light DOM). It does NOT reach the Vue
 * shell's shadow root — that is handled by Playwright's `animations: 'disabled'`
 * (see playwright.config.ts), which additionally finishes running animations at
 * capture time. `toHaveScreenshot` then waits for two stable frames on its own,
 * so no fixed sleep is needed after this.
 */
export async function stabilize(page: Page): Promise<void> {
	await page.waitForFunction(
		() => !document.getElementById('attrium-body-hider'),
	)

	// The shell mounted and swallowed the WordPress content.
	await expect(page.locator(HOST)).toBeAttached()
	await expect(page.locator(`${HOST} > #wpcontent`)).toBeAttached()

	await page.evaluate(async () => {
		await document.fonts.ready
	})

	await page.addStyleTag({
		content: `*, *::before, *::after {
			animation-duration: 0s !important;
			animation-delay: 0s !important;
			transition-duration: 0s !important;
			transition-delay: 0s !important;
			caret-color: transparent !important;
			scroll-behavior: auto !important;
		}`,
	})
}

/**
 * Hard ceiling on the grown viewport. Chromium refuses absurd window sizes and
 * a runaway page shouldn't produce a 20k-pixel baseline.
 */
const MAX_CAPTURE_HEIGHT = 8000

/**
 * Grow the viewport to fit the whole screen, and return the element to capture.
 *
 * Getting a full-screen shot in this app takes two non-obvious steps.
 *
 * First, `toHaveScreenshot({ fullPage: true })` does NOT work. `fullPage`
 * extends the capture to the *document* scroll height, but `#attrium-host` is
 * `position: fixed; inset: 0; overflow-y: auto`, so the document never scrolls
 * — `documentElement.scrollHeight` stays exactly the viewport height while the
 * host scrolls internally. Every `fullPage` baseline came out exactly 1440x900.
 *
 * Second, simply snapshotting the host is not enough either: an element
 * screenshot captures the element's BOUNDING BOX, and because the host is
 * `position: fixed` its box is always viewport-sized. On themes.php the host
 * measures 1440x900 while its scrollHeight is 2318 — so the capture still
 * clipped ~61% of the page.
 *
 * So we grow the viewport to the host's scroll height first, which makes the
 * fixed host expand to its full content height (verified: 1440x2318), then
 * capture it. Returning to a fixed viewport between tests is handled by
 * Playwright's per-test context isolation.
 */
export async function snapshotTarget(page: Page): Promise<Locator> {
	const host = page.locator(HOST)
	const { width, height: vpHeight } = page.viewportSize() ?? {
		width: 1440,
		height: 900,
	}

	// Wait for the host's scrollHeight to exceed the viewport. After the
	// Attrium shell mounts and #wpcontent is reparented, the embedded
	// WordPress page may still be laying out (async scripts, lazy images,
	// reflows from shadow-root style application). If we measure
	// scrollHeight too early, it equals the viewport height and the
	// capture is cropped. Poll until it stabilises above the viewport or
	// we time out (a short timeout is fine — most screens settle in <1s).
	const MAX_WAIT_MS = 5000
	const POLL_MS = 100
	let scrollHeight = await host.evaluate((el) => el.scrollHeight)
	for (let waited = 0; waited < MAX_WAIT_MS && scrollHeight <= vpHeight; waited += POLL_MS) {
		await page.waitForTimeout(POLL_MS)
		scrollHeight = await host.evaluate((el) => el.scrollHeight)
	}
	if (scrollHeight <= vpHeight) {
		console.warn(
			`[visual] scrollHeight (${scrollHeight}px) did not exceed viewport ` +
				`(${vpHeight}px) after ${MAX_WAIT_MS}ms — screenshot may be cropped. ` +
				`This usually means the page did not fully layout before snapshotting.`,
		)
	}

	// Growing the viewport reflows the embedded WP page (media grids,
	// responsive tables), which can reveal more content and push scrollHeight
	// up again — so the height must be RE-MEASURED after each resize, not
	// assumed from the first reading. Loop until it stops growing (or we hit
	// the cap); a handful of iterations is plenty, the bound is just a
	// guard against a page that grows on every reflow forever.
	let needed = scrollHeight
	let height = Math.min(needed, MAX_CAPTURE_HEIGHT)

	for (let i = 0; i < 5; i++) {
		if (height <= (page.viewportSize()?.height ?? 0)) break

		await page.setViewportSize({ width, height })
		await page.evaluate(async () => {
			await document.fonts.ready
		})

		const remeasured = await host.evaluate((el) => el.scrollHeight)
		if (remeasured <= height) break

		needed = remeasured
		height = Math.min(remeasured, MAX_CAPTURE_HEIGHT)
	}

	if (needed > MAX_CAPTURE_HEIGHT) {
		console.warn(
			`[visual] screen content is ${needed}px tall; capture capped at ` +
				`${MAX_CAPTURE_HEIGHT}px, so the remainder is NOT covered.`,
		)
	}

	return host
}
