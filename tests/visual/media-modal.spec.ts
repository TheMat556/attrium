import { expect, type Locator, type Page, test } from '@playwright/test'
import { applyTheme, stabilize, THEMES, type Theme } from './support/theme'

/**
 * Media modal ("Attachment details", #wp-media-modal) on upload.php.
 *
 * `scss/screens/_upload.scss` reskins the modal that media-views.js appends
 * straight to <body> when a grid tile is clicked: the token panel with
 * rounded corners over a dark scrim, Lucide icon buttons in the header, the
 * recessed info column, and the tokenized setting labels/links. The dark
 * palette reaches this body-level overlay through a dedicated carrier arm
 * (`html.attrium-dark body.attrium-mod-screens.upload-php .media-modal` —
 * $dark-carrier-media in scss/_tokens.scss); without it the modal would
 * render the light palette over the dark shell, which is exactly what this
 * capture pins.
 *
 * Like theme-details-overlay.spec.ts: the modal is fixed at a 30px inset,
 * so the fixed 1440x900 viewport IS the capture — growing it would only
 * pad the shot with dimmed backdrop. The modal's content is deterministic:
 * fixture 1 (the grid's date-DESC query makes the newest pinned date the
 * first tile), with pinned upload dates and a pinned upload subdir — the
 * File URL field renders the full path.
 */
async function openAttachmentModal(page: Page, theme: Theme): Promise<void> {
	await applyTheme(page, theme)
	await page.goto('/wp-admin/upload.php', { waitUntil: 'networkidle' })
	await stabilize(page)

	// A plain tile click opens the edit modal (MediaFrame.Manage runs modes
	// grid+edit; see media-frame.spec.ts).
	const tile: Locator = page.locator('.attachments > .attachment').first()
	await tile.click()
	await expect(
		page.locator('.media-modal-content .edit-attachment-frame'),
	).toBeVisible()

	// The frame populates from the collection, but the preview image loads
	// async — wait for it to be decoded so the capture isn't mid-paint.
	await page.waitForFunction(() => {
		const img = document.querySelector('.media-modal .details-image')
		return (
			img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0
		)
	})
	await expect(page.locator('#attachment-details-two-column-title')).toHaveValue(
		'Attrium Fixture 1',
	)
}

for (const { theme } of THEMES) {
	test.describe(`theme: ${theme}`, () => {
		test('attachment details modal', async ({ page }) => {
			await openAttachmentModal(page, theme)
			await expect(page).toHaveScreenshot(`media-modal-${theme}.png`)
		})
	})
}
