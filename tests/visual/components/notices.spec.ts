import { expect, type Locator, test } from '@playwright/test'
import { applyTheme, stabilize, THEMES } from '../support/theme'

/**
 * Notice regression.
 *
 * The `scss/modules/_notices.scss` module restyles WordPress admin notices
 * (`.notice:not(.hidden)`). The mu-plugin `attrium-visual-determinism.php`
 * renders one deterministic `.notice.notice-info.is-dismissible` on every
 * screen, so the container, `.title`, `p`, and the `.notice-dismiss` button
 * are exercised by a real notice.
 *
 * The success/warning/error variants have no matching core screen (fresh
 * install, transients frozen), so those are injected. The module styles them
 * only via the `border-left-color` per-variant rules, so a minimal injected
 * notice (title + body, no dismiss button — core's JS only decorates
 * `.is-dismissible`) is enough to guard them.
 *
 * Target: profile.php — side-effect-free and guaranteed to carry the mu-plugin
 * notice.
 */

const VARIANTS = ['success', 'warning', 'error'] as const

for (const { theme } of THEMES) {
	test.describe(`theme: ${theme}`, () => {
		test.beforeEach(async ({ page }) => {
			await applyTheme(page, theme)
			await page.goto('/wp-admin/profile.php', {
				waitUntil: 'domcontentloaded',
			})
			await stabilize(page)
		})

		test('info', async ({ page }) => {
			const notice: Locator = page.locator('.notice.notice-info')
			await expect(notice).toBeVisible()
			await notice.scrollIntoViewIfNeeded()
			await expect(notice).toHaveScreenshot(`notice-info-${theme}.png`)
		})

		test('dismiss hover', async ({ page }) => {
			const dismiss: Locator = page.locator('.notice-dismiss')
			await expect(dismiss).toBeVisible()
			await dismiss.scrollIntoViewIfNeeded()
			await dismiss.hover()
			await expect(dismiss).toHaveScreenshot(`notice-dismiss-hover-${theme}.png`)
		})

		for (const variant of VARIANTS) {
			test(variant, async ({ page }) => {
				// Injected: no core screen renders these variants — see header.
				await page.evaluate((name) => {
					const notice = document.createElement('div')
					notice.className = `notice notice-${name}`
					notice.innerHTML =
						`<p class="title">${name} title</p><p>${name} body</p>`
					const anchor =
						document.querySelector('.notice')?.parentElement ??
						document.querySelector('#wpcontent')
					anchor?.appendChild(notice)
				}, variant)
				const notice: Locator = page.locator(`.notice.notice-${variant}`)
				await expect(notice).toBeVisible()
				await notice.scrollIntoViewIfNeeded()
				await expect(notice).toHaveScreenshot(`notice-${variant}-${theme}.png`)
			})
		}
	})
}
