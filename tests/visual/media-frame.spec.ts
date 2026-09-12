import { expect, test, type Page } from '@playwright/test'
import { applyTheme, stabilize, THEMES } from './support/theme'

/**
 * Media Library (upload.php, grid mode): behavioral regression for the
 * restyle in `scss/screens/_upload.scss`.
 *
 * No screenshots and no baselines — the pattern of theme-resolution.spec.ts.
 * The `upload` baseline in screens.spec.ts pins the pixels; this spec pins
 * the STRUCTURE behind them, which a pixel diff would happily accept after
 * a "regenerate baselines" run hid a regression:
 *   - the toolbar is one unwrapped flex row (wrapping would grow past
 *     core's fixed top:72px attachments offset and overlap the grid —
 *     which is why a cramped window must scroll instead of wrap),
 *   - the view-switch links mask LUCIDE glyphs: core's dashicons on
 *     a::before are display:none, the ::after overlays carry two DIFFERENT
 *     data-URI masks, and the current view is visually distinct,
 *   - the tile check chip masks the Lucide check (core's uploader sprite
 *     is gone) and repaints on selection,
 *   - the attachments ul is a flex-wrap grid of uniform tiles, flush with
 *     the toolbar's left edge, with the search pinned into the toolbar's
 *     right padding.
 *
 * The tiles come from the mu-plugin's fixture attachments
 * (attrium-visual-determinism.php) — a fresh wp-env install ships an empty
 * media library, which is exactly why this used to be untestable.
 */

const TOOLBAR = '.attachments-browser .media-toolbar'
const TILES = '.attachments > .attachment'

for (const { theme } of THEMES) {
	test.describe(`theme: ${theme}`, () => {
		test.beforeEach(async ({ page }) => {
			await applyTheme(page, theme)
			await page.goto('/wp-admin/upload.php', { waitUntil: 'networkidle' })
			await stabilize(page)
		})

		test('media frame: page heading and title action use Attrium font', async ({
			page,
		}) => {
			const fonts = await page.evaluate(() => {
				const heading = document.querySelector('#wp-media-grid > h1')
				const action = document.querySelector('#wp-media-grid .page-title-action')
				if (!heading || !action) throw new Error('media page title elements missing')
				return {
					heading: getComputedStyle(heading).fontFamily,
					action: getComputedStyle(action).fontFamily,
				}
			})

			expect(fonts.heading).toContain('Inter Variable')
			expect(fonts.action).toContain('Inter Variable')
		})

		test('media frame: toolbar is one unwrapped flex row', async ({
			page,
		}) => {
			const layout = await page.locator(TOOLBAR).evaluate((el) => ({
				display: getComputedStyle(el).display,
				wrap: getComputedStyle(el).flexWrap,
				align: getComputedStyle(el).alignItems,
				minHeight: getComputedStyle(el).minHeight,
				secondary: (() => {
					const child = el.querySelector('.media-toolbar-secondary')
					if (!child) throw new Error('secondary toolbar missing')
					const cs = getComputedStyle(child)
					return {
						display: cs.display,
						flex: cs.flex,
						wrap: cs.flexWrap,
						align: cs.alignItems,
					}
				})(),
			}))

			expect(layout).toEqual({
				display: 'flex',
				wrap: 'nowrap',
				align: 'center',
				minHeight: '48px',
				secondary: {
					display: 'flex',
						flex: '0 0 auto',
					wrap: 'nowrap',
					align: 'center',
				},
			})
		})

		test('media frame: view-switch masks Lucide glyphs', async ({ page }) => {
			const views = await page.evaluate(() => {
				const read = (link: Element) => ({
					glyph: getComputedStyle(link, ':after').maskImage,
					before: getComputedStyle(link, ':before').display,
					surface: getComputedStyle(link).backgroundColor,
				})
				const list = document.querySelector('.view-switch .view-list')
				const grid = document.querySelector('.view-switch .view-grid')
				if (!list || !grid) throw new Error('view-switch links missing')
				return { list: read(list), grid: read(grid) }
			})

			// Core's dashicons are gone; the Lucide masks are painted and the
			// two views carry two different glyphs.
			for (const view of [views.list, views.grid]) {
				expect(view.before).toBe('none')
				expect(view.glyph).toContain('data:image/svg+xml')
			}
			expect(views.list.glyph).not.toBe(views.grid.glyph)

			// The current view (grid, by default) is visually distinct.
			expect(views.grid.surface).not.toBe('rgba(0, 0, 0, 0)')
		})

		test('media frame: flex grid of uniform, aligned tiles', async ({
			page,
		}) => {
			const data = await page.evaluate(() => {
				const ul = document.querySelector('.attachments')
				const toolbar = document.querySelector(
					'.attachments-browser .media-toolbar',
				)
				const primary = document.querySelector(
					'.attachments-browser .media-toolbar-primary',
				)
				if (!ul || !toolbar || !primary) {
					throw new Error('media frame missing')
				}

				const rects = [...document.querySelectorAll<HTMLElement>(
					'.attachments > .attachment',
				)].map((tile) => tile.getBoundingClientRect())

				// First tile of the wrapped second row.
				const row2 = rects.find((r) => r.top > rects[0].top + 1)

				// Edge insets measured from the COMPUTED box, not hardcoded:
				// core's toolbar padding differs across versions (16px in some,
				// 10px in others). The invariant is that the search is flush
				// with the toolbar's own content edge, and the first tile with
				// the ul's content edge — whatever those edges are.
				const toolbarCS = getComputedStyle(toolbar)
				const toolbarInset =
					parseFloat(toolbarCS.paddingRight) +
					parseFloat(toolbarCS.borderRightWidth)

				return {
					ulDisplay: getComputedStyle(ul).display,
					ulPadding: getComputedStyle(ul).padding,
					liPadding: getComputedStyle(
						document.querySelector('.attachments > .attachment') ?? ul,
					).padding,
					ulPadLeft: parseFloat(getComputedStyle(ul).paddingLeft),
					ulLeft: ul.getBoundingClientRect().left,
					ulTop: ul.getBoundingClientRect().top,
					toolbarBottom: toolbar.getBoundingClientRect().bottom,
					toolbarRight: toolbar.getBoundingClientRect().right,
					toolbarInset,
					primaryRight: primary.getBoundingClientRect().right,
					tileCount: rects.length,
					tileWidths: [...new Set(rects.map((r) => Math.round(r.width)))],
					tileTops: [...new Set(rects.map((r) => Math.round(r.top)))],
					firstTileLeft: rects[0].left,
					firstTileBottom: rects[0].bottom,
					row2Left: row2?.left ?? -1,
					row2Top: row2?.top ?? -1,
				}
			})

			expect(data.ulDisplay).toBe('flex')
			// The mu-plugin seeds exactly ten fixture attachments (nine
			// images + the long-filename PDF caption fixture).
			expect(data.tileCount).toBe(10)
			// One uniform tile width (flex-wrap + core's [data-columns] widths).
			expect(data.tileWidths).toHaveLength(1)

			// The FLUSH layout: the ul carries no left/right/bottom padding
			// (only core's 2px top hairline) and each tile no top/left/bottom
			// padding — the 8px right padding is the sole column gutter.
			expect(data.ulPadding).toBe('2px 0px 0px')
			expect(data.liPadding).toBe('0px 8px 0px 0px')

			// Alignment invariants. The first tile sits at the ul's content
			// edge (its padding is core's, whatever it is)…
			expect(
				Math.abs(data.firstTileLeft - (data.ulLeft + data.ulPadLeft)),
			).toBeLessThanOrEqual(1)
			// …the search is flush with the toolbar's own content edge (the
			// flex row pins it there via margin-left: auto)…
			expect(
				Math.abs(data.toolbarRight - data.toolbarInset - data.primaryRight),
			).toBeLessThanOrEqual(1)
			// …and the toolbar must never grow past core's fixed top:72px
			// attachments offset (the reason the row must not wrap).
			expect(data.toolbarBottom).toBeLessThanOrEqual(data.ulTop + 1)

			// Ten tiles at the capture width wrap past the first row (7
			// columns at this viewport): the second row is the flex-wrap
			// alignment this restyle exists to guarantee — and with the
			// flush padding the rows stack with ZERO row gap.
			expect(data.tileTops.length).toBeGreaterThanOrEqual(2)
			expect(data.row2Left).toBeGreaterThanOrEqual(0)
			expect(Math.abs(data.row2Left - data.firstTileLeft)).toBeLessThanOrEqual(
				1,
			)
			expect(Math.abs(data.row2Top - data.firstTileBottom)).toBeLessThanOrEqual(
				1,
			)
		})

		test('media frame: tiles wear the Attrium card chrome', async ({
			page,
		}) => {
			const preview = page
				.locator(`${TILES} .attachment-preview`)
				.first()

			const chrome = await preview.evaluate((el) => {
				const cs = getComputedStyle(el)
				const thumbnail = el.querySelector('.thumbnail')
				return {
					radius: cs.borderRadius,
					border: `${cs.borderTopWidth} ${cs.borderTopStyle}`,
					overflow: cs.overflow,
					previewShadow: cs.boxShadow,
					thumbFrame: thumbnail
						? getComputedStyle(thumbnail, '::after').boxShadow
						: 'missing',
					restingBorder: cs.borderTopColor,
					switchGap: getComputedStyle(
						document.querySelector('.view-switch') ?? document.body,
					).columnGap,
				}
			})

			// The two view toggles are separated by a gap (core rendered
			// them flush against each other).
			expect(chrome.switchGap).toBe('4px')

			// Card chrome: token radius + hairline border + clipped corners,
			// with core's hardcoded inset shadow frames gone.
			expect(chrome.radius).toBe('8px')
			expect(chrome.border).toBe('1px solid')
			expect(chrome.overflow).toBe('hidden')
			expect(chrome.previewShadow).toBe('none')
			expect(chrome.thumbFrame).toBe('none')

			// Hover brightens the border to the ring token.
			await page.locator(TILES).first().hover()
			const hoveredBorder = await preview.evaluate(
				(el) => getComputedStyle(el).borderTopColor,
			)
			expect(hoveredBorder).not.toBe(chrome.restingBorder)
		})

		test('media frame: filename caption bar is one truncated line', async ({
			page,
		}) => {
			// The PDF fixture is the tile that renders .filename on 6.7
			// (image tiles carry no name strip there — 7.1 paints theirs on
			// the li::after pseudo with the same recipe).
			const caption = page.locator(`${TILES} .filename`).first()
			await expect(caption).toBeAttached()

			const bar = await caption.evaluate((el) => {
				const cs = getComputedStyle(el)
				const text = el.querySelector('div')
				return {
					whiteSpace: cs.whiteSpace,
					textOverflow: cs.textOverflow,
					overflow: cs.overflow,
					borderTop: `${cs.borderTopWidth} ${cs.borderTopStyle}`,
					textAlign: cs.textAlign,
					divPadding: text
						? getComputedStyle(text).padding
						: 'missing',
					// The long fixture name exceeds the bar at one tile
					// width — the ellipsis clips rather than wraps.
					clipped: el.scrollWidth > el.clientWidth,
				}
			})

			expect(bar.whiteSpace).toBe('nowrap')
			expect(bar.textOverflow).toBe('ellipsis')
			expect(bar.overflow).toBe('hidden')
			// Hairline top border; the card's own border frames the rest.
			expect(bar.borderTop).toBe('1px solid')
				// Core centered .filename; the caption bar starts at the left.
				expect(bar.textAlign).toBe('start')
				// No padding at all — the text hugs the card's corner and
				// the ellipsis runs to the bar's right edge.
				expect(bar.divPadding).toBe('0px')
				expect(bar.clipped).toBe(true)
		})

		test('media frame: tile check chip paints the Lucide check', async ({
			page,
		}) => {
			// Resting state: the chip is display:none until selection.
			const chip = page.locator(`${TILES}.selected .check`)
			await expect(chip).toBeHidden()

			// A plain tile click on upload.php opens the edit modal —
			// MediaFrame.Manage runs modes grid+edit, so the click-to-select
			// interaction (and with it the check chip) lives in bulk-select
			// mode: the toggle flips the frame to mode-select.
			await page.locator(`${TOOLBAR} .select-mode-toggle-button`).click()
			await expect(
				page.locator(`${TOOLBAR}.media-toolbar-mode-select`),
			).toBeAttached()

			await page
				.locator(`${TILES} .attachment-preview`)
				.first()
				.click()
			await expect(chip).toBeVisible()

			// Selection also repaints the card edge: the primary ring
			// replaces core's inset white/grey selection frame.
			const selected = await chip.evaluate((el) => {
				const li = el.closest('.attachment')
				const tilePreview = li?.querySelector('.attachment-preview')
				if (!li || !tilePreview) {
					throw new Error('selected tile missing')
				}
				return {
					liShadow: getComputedStyle(li).boxShadow,
					previewShadow: getComputedStyle(tilePreview).boxShadow,
				}
			})
			// The click focused the li: its box-shadow must be fully gone —
			// core paints its own focus frame there (inset admin-color
			// ring), misaligned with the flush layout — and the card
			// carries the token selection edge instead.
			expect(selected.liShadow).toBe('none')
			expect(selected.previewShadow).not.toBe('none')

			const paint = await chip.evaluate((el) => {
				const icon = el.querySelector('.media-modal-icon')
				return {
					glyph: icon ? getComputedStyle(icon).maskImage : '',
					surface: getComputedStyle(el).backgroundColor,
					size: icon ? getComputedStyle(icon).width : '',
				}
			})

			// …with the Lucide mask instead of core's uploader sprite, and
			// the selected paint instead of core's theme blue.
			expect(paint.glyph).toContain('data:image/svg+xml')
			expect(paint.surface).not.toBe('rgba(0, 0, 0, 0)')
			expect(paint.size).toBe('14px')

			// The chip button deselects again (its accessible name says so).
			await chip.click()
			await expect(page.locator(`${TILES}.selected`)).toHaveCount(0)
		})

		// ---- Attachment-details modal ----------------------------------------
		//
		// The modal's structure is pinned here, its pixels by
		// media-modal.spec.ts. The load-bearing assertion is the CARRIER:
		// the modal is appended to <body>, outside #attrium-host, so the
		// dark palette only reaches it through the scoped carrier arm in
		// _tokens.scss ($dark-carrier-media) — reading the custom
		// properties ON the modal verifies that arm fires per theme.

		async function openModal(page: Page): Promise<void> {
			await page.locator(`${TILES} .attachment-preview`).first().click()
			await expect(
				page.locator('.media-modal-content .edit-attachment-frame'),
			).toBeVisible()
			// Fixture 1 is the first tile (the grid queries date DESC and
			// the mu-plugin seeds distinct pinned dates).
			await expect(
				page.locator('#attachment-details-two-column-title'),
			).toHaveValue('Attrium Fixture 1')
		}

		test('media modal: scoped dark carrier ships the palette', async ({
			page,
		}) => {
			await openModal(page)

			const palette = await page.evaluate(() => {
				const modal = document.querySelector('.media-modal')
				if (!modal) throw new Error('modal missing')
				const cs = getComputedStyle(modal)
				return {
					panel: cs.getPropertyValue('--attrium-primary-foreground').trim(),
					recessed: cs.getPropertyValue('--attrium-background').trim(),
				}
			})

			// The palette literals from scss/_tokens.scss: light values from
			// :root, dark values from the $dark-carrier-media arm.
			const expected =
				theme === 'dark'
					? { panel: 'oklch(20.5% 0 0)', recessed: 'oklch(23.5% 0 0)' }
					: { panel: 'oklch(98.5% 0 0)', recessed: 'oklch(96.5% 0 0)' }

			expect(palette).toEqual(expected)
		})

		test('media modal: header buttons are Lucide icon buttons', async ({
			page,
		}) => {
			await openModal(page)

			const header = await page.evaluate(() => {
				const read = (selector: string) => {
					const el = document.querySelector(selector)
					if (!el) throw new Error(`${selector} missing`)
					const cs = getComputedStyle(el)
					return {
						position: cs.position,
						size: cs.width,
						glyph: getComputedStyle(el, ':after').maskImage,
						before: getComputedStyle(el, ':before').display,
					}
				}
				const strip = document.querySelector('.edit-media-header')
				const glyphSpan = document.querySelector(
					'.media-modal-close .media-modal-icon',
				)
				if (!strip || !glyphSpan) throw new Error('header missing')
				return {
					strip: {
						display: getComputedStyle(strip).display,
						justify: getComputedStyle(strip).justifyContent,
						height: getComputedStyle(strip).height,
					},
					left: read('.edit-media-header .left'),
					right: read('.edit-media-header .right'),
					close: read('.media-modal-close'),
					closeGlyphSpan: getComputedStyle(glyphSpan).display,
				}
			})

			// The strip is a flex row, 50px tall (core's frame constant —
			// .media-frame-content is offset to it).
			expect(header.strip).toEqual({
				display: 'flex',
				justify: 'flex-end',
				height: '50px',
			})

			// Prev/next/close: in-flow 32px icon buttons (core parks them
			// as absolute 50px boxes), core's dashicons gone, Lucide masked
			// on the ::after overlay — and the close button's own glyph span
			// (core's \f335 dashicon carrier) hidden.
			for (const button of [header.left, header.right, header.close]) {
				expect(button.position).toBe('relative')
				expect(button.size).toBe('32px')
				expect(button.before).toBe('none')
				expect(button.glyph).toContain('data:image/svg+xml')
			}
			expect(header.left.glyph).not.toBe(header.right.glyph)
			expect(header.closeGlyphSpan).toBe('none')
		})

		test('media modal: panel and info column wear token chrome', async ({
			page,
		}) => {
			await openModal(page)

			// Setting textareas: core squeezed them to 62px/50px (~2.5
			// lines); the restyle gives alt-text 6rem (≈4 lines) and
			// caption/description 8.25rem (≈6 lines), keeping core's
			// manual resize:vertical.
			const heights = await page.evaluate(() => {
				const r = (id: string) => {
					const el = document.getElementById(id)
					if (!el) throw new Error(`${id} missing`)
					const cs = getComputedStyle(el)
					return { h: cs.height, resize: cs.resize }
				}
				return {
					alt: r('attachment-details-two-column-alt-text'),
					caption: r('attachment-details-two-column-caption'),
					description: r('attachment-details-two-column-description'),
				}
			})
			expect(heights.alt.h).toBe('96px')
			expect(heights.caption.h).toBe('132px')
			expect(heights.description.h).toBe('132px')
			for (const h of [heights.alt, heights.caption, heights.description]) {
				expect(h.resize).toBe('vertical')
			}

			const chrome = await page.evaluate(() => {
				const panel = document.querySelector('.media-modal-content')
				const info = document.querySelector(
					'.edit-attachment-frame .attachment-info',
				)
				const title = document.querySelector(
					'.edit-attachment-frame .media-frame-title h1',
				)
				const content = document.querySelector(
					'.edit-attachment-frame .media-frame-content',
				)
				const canvas = document.querySelector(
					'.edit-attachment-frame .attachment-media-view .thumbnail',
				)
				const image = document.querySelector('.details-image')
				if (!panel || !info || !title || !content || !canvas || !image) {
					throw new Error('modal missing')
				}
				const ps = getComputedStyle(panel)
				const is = getComputedStyle(info)
				const cs = getComputedStyle(content)
				const img = getComputedStyle(image)
				return {
					radius: ps.borderRadius,
					border: `${ps.borderTopWidth} ${ps.borderTopStyle}`,
					panelShadow: ps.boxShadow,
					panelBg: ps.backgroundColor,
					infoBg: is.backgroundColor,
					infoShadow: is.boxShadow,
					infoBorder: `${is.borderLeftWidth} ${is.borderLeftStyle}`,
					contentTopBorder: cs.borderTopWidth,
					contentBg: cs.backgroundColor,
					canvasBg: getComputedStyle(canvas).backgroundColor,
					title: {
						size: getComputedStyle(title).fontSize,
						weight: getComputedStyle(title).fontWeight,
					},
					image: {
						radius: img.borderRadius,
						border: `${img.borderTopWidth} ${img.borderTopStyle}`,
						// Core's #c3c4c7 transparency checkerboard must be
						// gone — the background shorthand reset it.
						checkerboard: img.backgroundImage,
						surface: img.backgroundColor,
					},
				}
			})

			// Card recipe on the panel; the info column keeps a hairline
			// separator and loses core's inset scroll-affordance shadows.
			// The title scales down from core's 22px to the theme-overlay
			// heading scale.
			expect(chrome.radius).toBe('8px')
			expect(chrome.border).toBe('1px solid')
			expect(chrome.panelShadow).toBe('none')
			expect(chrome.infoShadow).toBe('none')
			expect(chrome.infoBorder).toBe('1px solid')
			expect(chrome.title).toEqual({ size: '16px', weight: '600' })

			// No hairline under the header strip: core's border-top on the
			// modal's .media-frame-content is removed, and — the bug this
			// pinned — core's hardcoded #fff background on it is replaced by
			// the panel token. The white was the "no bg behind the image"
			// dark-mode bug: nothing owned the left column's surface until
			// the canvas covered it.
			expect(chrome.contentTopBorder).toBe('0px')
			expect(chrome.contentBg).toBe(chrome.panelBg)

			// The media column is a recessed CANVAS — the same token as the
			// info column, so the modal reads as two symmetric recessed
			// columns on the elevated panel — and the preview image is the
			// elevated card on it (the panel's surface token): the grid's
			// tile-on-canvas recipe mirrored inside the modal. An opaque
			// image covers its own box, so the canvas is where the mat
			// around it actually shows.
			expect(chrome.canvasBg).toBe(chrome.infoBg)
			expect(chrome.canvasBg).not.toBe(chrome.panelBg)
			expect(chrome.image.surface).toBe(chrome.panelBg)

			// The preview image is carded like a grid tile: token radius,
			// hairline border — and core's checkerboard gradients replaced
			// by the card surface.
			expect(chrome.image.radius).toBe('8px')
			expect(chrome.image.border).toBe('1px solid')
			expect(chrome.image.checkerboard).toBe('none')
		})
	})
}
