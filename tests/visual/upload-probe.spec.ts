import { expect, test } from '@playwright/test'
import { applyTheme, stabilize, THEMES } from './support/theme'

/**
 * TEMPORARY probe for TODO-upload.md removal experiments. NOT committed.
 *
 * Prints computed values for every pending declaration (no assertions, so one
 * spec serves all experiments). Each experiment: remove one declaration,
 * `bun run build:css`, re-run, diff the printed values per theme.
 * Unchanged in BOTH themes => redundant => keep removed.
 * Changed => live => restore.
 */

const TILES = '.attachments > .attachment'

for (const { theme } of THEMES) {
	test.describe(`theme: ${theme}`, () => {
		test('upload probe: tiles', async ({ page }) => {
			await applyTheme(page, theme)
			await page.goto('/wp-admin/upload.php', { waitUntil: 'networkidle' })
			await stabilize(page)

			const out = await page.evaluate(() => {
				const r = (el: Element | null) => {
					if (!el) return 'missing'
					const cs = getComputedStyle(el)
					return {
						shadow: cs.boxShadow,
						borderTop: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
						bg: cs.backgroundColor,
						color: cs.color,
					}
				}
				const li = document.querySelector<HTMLElement>(
					'.attachments > .attachment',
				)
				if (!li) throw new Error('no tiles')
				li.focus()
				const focused = document.activeElement === li
				const liFocusShadow = getComputedStyle(li).boxShadow
				;(li as HTMLElement).blur()

				const filename = document.querySelector(
					'.attachments > .attachment .filename',
				)
				const after = li ? getComputedStyle(li, '::after') : null

				// Resting check chip: bulk-select mode WITHOUT selecting, so
				// the `&.selected` arm cannot cover the base arm.
				const toggle = document.querySelector(
					'.attachments-browser .media-toolbar .select-mode-toggle-button',
				)
				let chip: unknown = 'toggle-missing'
				if (toggle instanceof HTMLElement) {
					toggle.click()
					const chipEl = document.querySelector(
						'.attachments > .attachment:not(.selected) .check',
					)
					chip = r(chipEl)
				}
				return {
					liFocused: focused,
					liFocusShadow,
					filename: r(filename),
					liAfter: after
						? { content: after.content, shadow: after.boxShadow }
						: 'missing',
					checkResting: chip,
				}
			})
			console.log(`PROBE-TILES-${theme} ${JSON.stringify(out)}`)
			expect(out.liFocused).toBe(true)
		})

		test('upload probe: modal', async ({ page }) => {
			await applyTheme(page, theme)
			await page.goto('/wp-admin/upload.php', { waitUntil: 'networkidle' })
			await stabilize(page)
			await page.locator(`${TILES} .attachment-preview`).first().click()
			await expect(
				page.locator('.media-modal-content .edit-attachment-frame'),
			).toBeVisible()
			await expect(
				page.locator('#attachment-details-two-column-title'),
			).toHaveValue('Attrium Fixture 1')

			const out = await page.evaluate(() => {
				const q = (s: string) => {
					const el = document.querySelector(s)
					if (!el) throw new Error(`${s} missing`)
					return getComputedStyle(el)
				}
				const content = q('.edit-attachment-frame .media-frame-content')
				const panel = q('.media-modal-content')
				const info = q('.edit-attachment-frame .attachment-info')
				const strong = q('.edit-attachment-frame .attachment-info strong')
				const name = q('.attachment-details .setting .name')
				const canvas = q(
					'.edit-attachment-frame .attachment-media-view .thumbnail',
				)
				const image = q('.details-image')
				const del = q('.media-modal .delete-attachment')
				const successEl = document.querySelector(
					'.attachment-details .copy-to-clipboard-container .success',
				)
				return {
					contentBorderTop: content.borderTopWidth,
					contentBg: content.backgroundColor,
					panelBg: panel.backgroundColor,
					infoBg: info.backgroundColor,
					infoShadow: info.boxShadow,
					infoBorderLeft: `${info.borderLeftWidth} ${info.borderLeftStyle} ${info.borderLeftColor}`,
					infoStrong: strong.color,
					settingName: name.color,
					canvasBg: canvas.backgroundColor,
					imageBg: image.backgroundColor,
					imageBgImage: image.backgroundImage,
					imageBorder: `${image.borderTopWidth} ${image.borderTopStyle}`,
					imageRadius: image.borderRadius,
					deleteColor: del.color,
					successColor: successEl
						? getComputedStyle(successEl).color
						: 'missing',
				}
			})
			console.log(`PROBE-MODAL-${theme} ${JSON.stringify(out)}`)
		})
	})
}
