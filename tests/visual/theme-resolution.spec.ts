import { expect, test } from '@playwright/test'
import { applyTheme, HOST, stabilize } from './support/theme'

/**
 * Pins the single theme resolver to its three carriers.
 *
 * "Is the theme dark?" is answered once — by `Attrium\Utility\Theme`'s
 * synchronous inline script in `<head>`, printed on every Attrium page,
 * customize.php included (there is no shell there, but it still gets the
 * same script). This spec proves that one decision lands on all three
 * carriers: `html.attrium-dark` is set by the resolver itself, the shell's
 * `#attrium-host.dark` is its shadow-root mirror, and the Customizer has
 * only the html carrier — no host exists to mirror onto.
 *
 * `screens.spec.ts` and `customize.spec.ts` both drive light/dark through
 * `applyTheme()`, so the EXPLICIT values are covered on both surfaces
 * already. The uncovered states are the implicit ones, where the answer
 * comes from `prefers-color-scheme` instead of storage: key absent, and key
 * set to `auto`. Those are also the states a real first-time user lands in.
 *
 * No screenshots here — this reads the resolved carrier classes directly, so
 * it adds no baselines and cannot be broken by a legitimate restyle.
 */

/**
 * The carriers the resolver's decision lands on. `html.attrium-dark` is
 * universal — set pre-paint on every Attrium page — so it is asserted on
 * both legs (two entries keep each message naming the surface it verifies).
 * The shell's `dark` on `#attrium-host` is the shadow-root mirror of that
 * class (useTheme's MutationObserver), needed because CSS variables do not
 * cross the shadow-root boundary. See the `$dark` carrier comment in
 * `scss/_tokens.scss`.
 */
const CARRIERS = {
	shell: `${HOST}.dark`,
	html: 'html.attrium-dark',
	customizer: 'html.attrium-dark',
} as const

/**
 * A regular admin screen for the shell leg.
 *
 * Must NOT be one of the screens Attrium replaces with a native Vue view (see
 * `src/views/overrides.ts`): on those no `wp-content` slot renders and
 * `#wpcontent` is never reparented, so `stabilize()`'s mount assertion fails.
 * plugins.php is in `pages.ts`, so it is already known to work with it.
 */
const SHELL_PATH = '/wp-admin/plugins.php'

const CUSTOMIZER_PATH = '/wp-admin/customize.php'

/**
 * The implicit-resolution matrix. `stored: null` means the key is absent —
 * `applyTheme()` removes it on every navigation, which is required here:
 * `auth.setup.ts` lands on wp-admin before saving `storageState`, so
 * `attrium-theme: auto` is baked into `.auth/state.json` and restored into
 * every context. Removal re-establishes "absent" on each hop.
 */
const CASES = [
	{ stored: null, prefers: 'light', dark: false },
	{ stored: null, prefers: 'dark', dark: true },
	{ stored: 'auto', prefers: 'light', dark: false },
	{ stored: 'auto', prefers: 'dark', dark: true },
] as const

for (const { stored, prefers, dark } of CASES) {
	const label = `stored=${stored ?? 'absent'}, prefers-color-scheme=${prefers}`

	test.describe(label, () => {
		test.use({ colorScheme: prefers })

		test(`both surfaces resolve ${dark ? 'dark' : 'light'}`, async ({
			page,
		}) => {
			await applyTheme(page, stored)

			// Shell. stabilize() waits for the FOUC hider to be removed, which
			// main.ts only does after applyThemeToHost() has run, so the host
			// mirror is settled by then — no polling needed. The html carrier
			// was set pre-paint by the resolver, so it is final since first
			// parse.
			await page.goto(SHELL_PATH)
			await stabilize(page)

			const shellDark = await page
				.locator(HOST)
				.evaluate((el) => el.classList.contains('dark'))

			const shellHtmlDark = await page.evaluate(() =>
				document.documentElement.classList.contains('attrium-dark'),
			)

			// Customizer. The resolver script is inline in <head> — the same
			// one every admin page gets — so the class is on <html> from the
			// first parse; reaching the control pane is settle enough.
			await page.goto(CUSTOMIZER_PATH)
			await page.locator('#customize-controls').waitFor({ state: 'attached' })

			const customizerDark = await page.evaluate(() =>
				document.documentElement.classList.contains('attrium-dark'),
			)

			// Asserted against the expectation rather than against each other:
			// equality alone would pass if all carriers were wrong in the same
			// direction, which is exactly the drift a shared bug would cause.
			expect(shellDark, `${CARRIERS.shell} (${label})`).toBe(dark)
			expect(shellHtmlDark, `${CARRIERS.html} (${label})`).toBe(dark)
			expect(customizerDark, `${CARRIERS.customizer} (${label})`).toBe(dark)
		})
	})
}
