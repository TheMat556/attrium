import { expect, test } from '@playwright/test'
import { applyTheme, stabilize, THEMES } from './support/theme'

/**
 * Font Library reskin contract, without screenshots.
 *
 * `scss/screens/_font-library.scss` remaps the wpds React app's variables
 * onto Attrium tokens. No spec captures Appearance → Fonts (the app's class
 * names are per-build CSS-module hashes, so pixel baselines would be
 * brittle), which left 17 audit verdicts permanently unverified. Instead of
 * pixels, this pins the mapping itself: a fixture with the exact selectors
 * the file gates on, hostile inline values on every remapped variable (the
 * real app writes them inline, which is why the file needs `!important`),
 * and direct reads of the computed styles.
 *
 * No baselines, so a legitimate restyle cannot break this — only a changed
 * mapping (or a dropped `!important`) fails it. Light AND dark, because the
 * tokens resolve per theme.
 */

/** Every `--wpds-*` remap in `_font-library.scss` with its Attrium token. */
const REMAPS: Array<readonly [wpds: string, token: string]> = [
	['--wpds-color-background-surface-neutral', '--attrium-background'],
	['--wpds-color-background-surface-neutral-weak', '--attrium-card'],
	['--wpds-color-background-surface-neutral-strong', '--attrium-card'],
	['--wpds-color-foreground-content-neutral', '--attrium-foreground'],
	[
		'--wpds-color-foreground-content-neutral-weak',
		'--attrium-muted-foreground',
	],
	['--wpds-color-foreground-interactive-neutral', '--attrium-foreground'],
	[
		'--wpds-color-foreground-interactive-neutral-weak',
		'--attrium-muted-foreground',
	],
	['--wpds-color-stroke-surface-neutral', '--attrium-border'],
	['--wpds-color-stroke-surface-neutral-weak', '--attrium-border'],
	['--wpds-color-stroke-interactive-neutral', '--attrium-border'],
	['--wpds-color-background-interactive-neutral-weak', '--attrium-muted'],
	[
		'--wpds-color-background-interactive-neutral-weak-active',
		'--attrium-muted',
	],
]

const HOSTILE = 'rgb(255, 0, 0)'

for (const { theme } of THEMES) {
	test.describe(`theme: ${theme}`, () => {
		test.beforeEach(async ({ page }) => {
			await applyTheme(page, theme)
			await page.goto('/wp-admin/profile.php', {
				waitUntil: 'domcontentloaded',
			})
			await stabilize(page)

			// The reskin gates on body.attrium-mod-screens (module('screens'));
			// the fixture below is meaningless without it — fail loud here,
			// not with a green assertion set further down.
			await expect(page.locator('body.attrium-mod-screens')).toBeAttached()

			await page.evaluate(
				({ remaps, hostile }) => {
					const app = document.createElement('div')
					app.id = 'font-library-wp-admin-app'
					// Pinned above the shell overlay: the fixture lives on
					// document.body (NOT in #wpcontent) because the real font
					// library renders in the site editor, where there is no
					// #attrium-host — inside the slotted content the host's
					// dark `h2` rule would out-specify the title rule under
					// test. Positioning is outside every selector under test,
					// so it cannot affect the assertions.
					app.setAttribute(
						'style',
						'position: fixed; top: 0; left: 0; z-index: 2147483647;',
					)
					const provider = document.createElement('div')
					provider.setAttribute('data-wpds-theme-provider-id', '')
					// The real app writes these inline — the file beats them
					// with !important, so the fixture must too.
					provider.setAttribute(
						'style',
						remaps.map(([name]) => `${name}: ${hostile}`).join('; '),
					)
					app.appendChild(provider)
					app.insertAdjacentHTML(
						'beforeend',
						`<h2 class="font-library__fonts-title">Theme</h2>
						<button type="button" class="font-library__font-card">
							<span class="components-text">Inter</span>
							<span class="font-library__font-card__count">1 of 1 active</span>
						</button>
						<span data-probe="fg" style="color: var(--attrium-foreground)"></span>
						<span data-probe="muted-fg" style="color: var(--attrium-muted-foreground)"></span>
						<span data-probe="muted-bg" style="background: var(--attrium-muted)"></span>`,
					)
					document.body.appendChild(app)
				},
				{ remaps: REMAPS, hostile: HOSTILE },
			)
		})

		test('provider remaps beat app inlines', async ({ page }) => {
			const mismatches: string[] = await page.evaluate((remaps) => {
				const provider = document.querySelector(
					'#font-library-wp-admin-app [data-wpds-theme-provider-id]',
				)
				if (!provider) throw new Error('font-library fixture missing')
				const computed = getComputedStyle(provider)
				return remaps
					.filter(
						([wpds, token]) =>
							computed.getPropertyValue(wpds).trim() !==
							computed.getPropertyValue(token).trim(),
					)
					.map(
						([wpds, token]) =>
							`${wpds}: got ${computed.getPropertyValue(wpds).trim() || '(unset)'}, want ${computed.getPropertyValue(token).trim()}`,
					)
			}, REMAPS)
			expect(mismatches).toEqual([])
		})

		test('font list ink', async ({ page }) => {
			const ink = await page.evaluate(() => {
				const text = (selector: string, property: string) => {
					const el = document.querySelector(selector)
					if (!el) throw new Error(`font-library fixture misses ${selector}`)
					return getComputedStyle(el).getPropertyValue(property)
				}
				return {
					title: text('.font-library__fonts-title', 'color'),
					card: text('.font-library__font-card', 'color'),
					name: text('.font-library__font-card .components-text', 'color'),
					count: text('.font-library__font-card__count', 'color'),
					fg: text('[data-probe="fg"]', 'color'),
					mutedFg: text('[data-probe="muted-fg"]', 'color'),
				}
			})
			expect(ink.title).toBe(ink.mutedFg)
			expect(ink.card).toBe(ink.fg)
			expect(ink.name).toBe(ink.fg)
			expect(ink.count).toBe(ink.mutedFg)
		})

		test('font card hover', async ({ page }) => {
			await page.locator('.font-library__font-card').hover()
			const background = await page.evaluate(() => {
				const card = document.querySelector('.font-library__font-card')
				const probe = document.querySelector('[data-probe="muted-bg"]')
				if (!card || !probe) throw new Error('font-library fixture missing')
				return {
					card: getComputedStyle(card).backgroundColor,
					muted: getComputedStyle(probe).backgroundColor,
				}
			})
			expect(background.card).toBe(background.muted)
		})
	})
}
