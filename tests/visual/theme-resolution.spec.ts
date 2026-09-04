import { expect, test } from '@playwright/test'
import { applyTheme, HOST, stabilize } from './support/theme'

/**
 * Pins Attrium's two theme resolvers to each other.
 *
 * "Is the theme dark?" is answered twice, in two languages, because the two
 * answers are needed at different times:
 *   - `src/composables/useTheme.ts` — vueuse `useColorMode`, the shell's
 *     reactive owner (drives the toggle UI, writes storage, syncs across tabs).
 *     It cannot run pre-paint; it ships in the bundle.
 *   - `CustomizerSupport::theme_script()` — a synchronous inline script, because
 *     customize.php has no Attrium shell at all and a deferred module would
 *     paint light before flipping to dark.
 *
 * That split is inherent, so the duplication is not going away. What can go
 * away is it drifting silently: the two must agree for every stored value, and
 * nothing else asserts that. `screens.spec.ts` and `customize.spec.ts` both
 * drive light/dark through `applyTheme()`, so the EXPLICIT values are covered
 * on both surfaces already. The uncovered states are the implicit ones, where
 * the answer comes from `prefers-color-scheme` instead of storage: key absent,
 * and key set to `auto`. Those are also the states a real first-time user
 * lands in.
 *
 * No screenshots here — this reads the resolved carrier class directly, so it
 * adds no baselines and cannot be broken by a legitimate restyle.
 */

/**
 * The carrier classes, one per surface. They differ by design: the shell's
 * `dark` on `#attrium-host` covers the shadow root (`:host(.dark)`) AND the
 * light-DOM WordPress content moved inside the host, while the Customizer has
 * no host and so uses `html.attrium-dark`. See the `$dark` carrier comment in
 * `scss/_tokens.scss`.
 */
const CARRIERS = {
	shell: `${HOST}.dark`,
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
 * `applyTheme()` removes it on every navigation, which is required here (see
 * its docblock: both the persisted auth state and the shell itself write
 * `auto` back).
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
			// main.ts only does after applyThemeToHost() has run, so the carrier
			// is settled by then — no polling needed.
			await page.goto(SHELL_PATH)
			await stabilize(page)

			const shellDark = await page
				.locator(HOST)
				.evaluate((el) => el.classList.contains('dark'))

			// Customizer. theme_script() is inline in <head>, so the class is on
			// <html> from the first parse; reaching the control pane is settle
			// enough.
			await page.goto(CUSTOMIZER_PATH)
			await page.locator('#customize-controls').waitFor({ state: 'attached' })

			const customizerDark = await page.evaluate(() =>
				document.documentElement.classList.contains('attrium-dark'),
			)

			// Asserted against the expectation rather than against each other:
			// equality alone would pass if both resolvers were wrong in the same
			// direction, which is exactly the drift a shared bug would cause.
			expect(shellDark, `${CARRIERS.shell} (${label})`).toBe(dark)
			expect(customizerDark, `${CARRIERS.customizer} (${label})`).toBe(dark)
		})
	})
}
