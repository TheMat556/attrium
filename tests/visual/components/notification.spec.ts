import { expect, type Locator, test } from '@playwright/test'
import { applyTheme, stabilize, THEMES } from '../support/theme'

/**
 * Notification-dialog regression.
 *
 * The `scss/modules/_notification.scss` module rounds `.notification-dialog` —
 * core's file-editor warning ("Heads up!") and filesystem-credentials prompt —
 * which core ships with square corners (edit.css).
 *
 * The dialog only renders on the theme/plugin editor and font library screens,
 * which are excluded from the page suite (theme editor: non-deterministic file
 * tree — see `pages.ts`). So it is injected here, replicating the
 * `wp-admin/theme-editor.php` markup, and captured on its own. The dialog's
 * inner content and its `.button` actions are core/Attrium-styled, so the
 * capture also exercises those outside the page suite.
 *
 * Target: profile.php — side-effect-free; the injected dialog is the only
 * `.notification-dialog` in the DOM.
 */

const DIALOG_MARKUP = `
<div class="notification-dialog">
  <div class="file-editor-warning-content">
    <div class="file-editor-warning-message">
      <h1>Heads up!</h1>
      <p>You appear to be making direct edits to your theme in the WordPress
         dashboard. It is not recommended!</p>
      <p>If you need to tweak more than your theme&#8217;s CSS, you might want
         to try <a href="https://developer.wordpress.org/themes/advanced-topics/child-themes/">making a child theme</a>.</p>
    </div>
    <p>
      <a class="button file-editor-warning-go-back" href="#">Go back</a>
      <button type="button" class="file-editor-warning-dismiss button button-primary">I understand</button>
    </p>
  </div>
</div>`

for (const { theme } of THEMES) {
	test.describe(`theme: ${theme}`, () => {
		test.beforeEach(async ({ page }) => {
			await applyTheme(page, theme)
			await page.goto('/wp-admin/profile.php', {
				waitUntil: 'domcontentloaded',
			})
			await stabilize(page)
		})

		test('file editor warning dialog', async ({ page }) => {
			await page.evaluate((markup) => {
				document.querySelector('#wpcontent')?.insertAdjacentHTML(
					'beforeend',
					markup,
				)
			}, DIALOG_MARKUP)
			const dialog: Locator = page.locator('.notification-dialog')
			await expect(dialog).toBeVisible()
			await dialog.scrollIntoViewIfNeeded()
			await expect(dialog).toHaveScreenshot(`notification-dialog-${theme}.png`)
		})
	})
}
