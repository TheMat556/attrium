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
 * with `overflow: hidden` — it does NOT scroll (the content card inside the
 * Vue app is the scroll container). It is both the capture target (see
 * `snapshotTarget`) and the element carrying the `dark` class.
 */
export const HOST = '#attrium-host'

/**
 * Every stored `attrium-theme` state Attrium has to resolve. `null` means the
 * key is absent, which `useColorMode` and CustomizerSupport::theme_script()
 * both treat the same as `'auto'`.
 */
export type StoredTheme = Theme | 'auto' | null

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
 *
 * `null` REMOVES the key rather than skipping the seed, and that difference is
 * load-bearing for `theme-resolution.spec.ts`. Two things put a value back:
 * `auth.setup.ts` lands on wp-admin before saving `storageState`, so
 * `attrium-theme: auto` is baked into .auth/state.json and restored into every
 * context; and `useColorMode`'s underlying `useStorage` writes its default, so
 * the shell re-writes `auto` on each visit. Because `addInitScript` runs before
 * page scripts on EVERY navigation, removing here re-establishes "absent" for
 * each hop — including the second one, after the first page already wrote.
 */
export async function applyTheme(
	page: Page,
	theme: StoredTheme,
): Promise<void> {
	await page.addInitScript((value) => {
		if (value === null) {
			localStorage.removeItem('attrium-theme')
			return
		}

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

	await freezeAnimations(page)
}

/**
 * Hard ceiling on the grown viewport. Chromium refuses absurd window sizes and
 * a runaway page shouldn't produce a 20k-pixel baseline.
 */
const MAX_CAPTURE_HEIGHT = 8000

/**
 * Neutralize animations/transitions/carets before a snapshot.
 *
 * `stabilize()` and the Customizer spec both need the same freeze; the Customizer
 * has no shadow root, so a single document-level style tag reaches everything
 * (the shell's shadow root is covered by Playwright's `animations: 'disabled'`).
 */
export async function freezeAnimations(page: Page): Promise<void> {
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
 * Grow the viewport until the given measure() reports the full content height.
 *
 * Shared by `snapshotTarget` (the Vue shell's content card) and the Customizer
 * spec (the sidebar scroll area): both apps are fixed/absolute (the document
 * never scrolls), so content must be revealed by growing the viewport. Growing
 * reflows the page, which can push the measured height up again, so the height
 * is re-measured after each resize until it stops growing (or hits the cap).
 *
 * `label` is used in the warnings so a cropped capture names the surface.
 */
export async function growViewportToFit(
	page: Page,
	measure: () => Promise<number>,
	label: string,
): Promise<void> {
	const { width } = page.viewportSize() ?? { width: 1440, height: 900 }

	// Wait for the measured height to SETTLE, not to exceed the viewport. After
	// the surface lays out, async scripts / lazy images / reflows may still be
	// moving it, and measuring mid-reflow crops the capture.
	//
	// Settling (two consecutive equal readings) is the correct signal, and
	// "taller than the viewport" is not: a screen whose content genuinely fits
	// in 900px can never satisfy it, so the old loop polled the full 5s and then
	// warned about a crop that had not happened — on 32 of the 48 captures
	// (every customize.spec capture plus 20 in screens.spec), i.e. ~2.5 min of
	// pure sleep per suite run.
	const MAX_WAIT_MS = 5000
	const POLL_MS = 100
	let needed = await measure()
	let settled = false

	for (let waited = 0; waited < MAX_WAIT_MS; waited += POLL_MS) {
		await page.waitForTimeout(POLL_MS)
		const again = await measure()
		if (again === needed) {
			settled = true
			break
		}
		needed = again
	}

	if (!settled) {
		console.warn(
			`[visual] ${label} content height never settled (last: ${needed}px) ` +
				`after ${MAX_WAIT_MS}ms — the capture may be cropped or mid-reflow.`,
		)
	}

	// Grow the viewport and re-measure after each resize until it stops growing
	// (or we hit the cap); the bound guards a page that grows on every reflow.
	let height = Math.round(Math.min(needed, MAX_CAPTURE_HEIGHT))

	for (let i = 0; i < 5; i++) {
		if (height <= (page.viewportSize()?.height ?? 0)) break

		await page.setViewportSize({ width, height })
		await page.evaluate(async () => {
			await document.fonts.ready
		})

		const remeasured = await measure()
		if (remeasured <= height) break

		needed = remeasured
		height = Math.round(Math.min(remeasured, MAX_CAPTURE_HEIGHT))
	}

	if (needed > MAX_CAPTURE_HEIGHT) {
		console.warn(
			`[visual] ${label} content is ${needed}px tall; capture capped at ` +
				`${MAX_CAPTURE_HEIGHT}px, so the remainder is NOT covered.`,
		)
	}
}

/**
 * Grow the viewport to fit the whole screen, and return the element to capture.
 *
 * Getting a full-screen shot in this app takes two non-obvious steps.
 *
 * First, `toHaveScreenshot({ fullPage: true })` does NOT work. `fullPage`
 * extends the capture to the *document* scroll height, but `#attrium-host` is
 * `position: fixed; inset: 0` with `overflow: hidden` and the app is a
 * fixed-height column (pinned header + content card). The document never
 * scrolls — `documentElement.scrollHeight` stays exactly the viewport height
 * while the content scrolls inside the card. Every `fullPage` baseline came
 * out exactly 1440x900.
 *
 * Second, simply snapshotting the host is not enough either: an element
 * screenshot captures the element's BOUNDING BOX, and because the host is
 * `position: fixed` its box is always viewport-sized. On themes.php the host
 * measures 1440x900 while its content card is 2318px tall — so the capture
 * still clipped ~61% of the page.
 *
 * So we grow the viewport to the content card's full height first. Because the
 * card is `flex-1` inside the fixed-height host, growing the viewport makes
 * the whole chain expand and the card's scrollable content becomes fully
 * visible (verified: 1440x2318). `data-attrium-scroll` (set in src/App.vue on
 * the rounded content card) is the internal scroll container whose
 * `scrollHeight` is the real content height; the host no longer grows, so it
 * cannot be used as the sizing signal anymore. Returning to a fixed viewport
 * between tests is handled by Playwright's per-test context isolation.
 */
export async function snapshotTarget(page: Page): Promise<Locator> {
	const host = page.locator(HOST)

	// Total page height needed to show the whole content without the card
	// scrolling internally: the card's full content height plus the fixed
	// chrome above and below it (sidebar-inset top margin + header, bottom
	// margin). The card box itself never moves (its content scrolls inside),
	// so getBoundingClientRect offsets relative to the host are stable.
	const measure = () =>
		host.evaluate((el) => {
			const card = el.shadowRoot?.querySelector('[data-attrium-scroll]')
			if (!card) return 0
			const hostRect = el.getBoundingClientRect()
			const cardRect = card.getBoundingClientRect()
			return (
				card.scrollHeight +
				(cardRect.top - hostRect.top) +
				(hostRect.bottom - cardRect.bottom)
			)
		})

	await growViewportToFit(page, measure, 'screen')

	return host
}
