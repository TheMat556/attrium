import { expect, type Locator, type Page, test } from '@playwright/test'
import {
	applyTheme,
	snapshotTarget,
	stabilize,
	THEMES,
	type Theme,
} from './support/theme'

/**
 * Edit Media (post.php?post=<id>&action=edit on an attachment).
 *
 * `scss/screens/_attachment-edit.scss` reskins the metabox chrome core
 * paints hardcoded (white postbox slabs, the #f6f7f7 submitdiv footer,
 * the #fff title background, the #b32d2e delete link). This spec pins the
 * pixels AND the structure behind them — the pattern of
 * media-frame.spec.ts, whose behavioral half lives here too because the
 * page is only reachable through the modal flow.
 *
 * Navigated by the user's path (upload.php → tile click → "Edit more
 * details" link in the modal) rather than a post.php?post=<id> URL: the
 * fixture attachment IDs are an artifact of the fresh-install sequence,
 * while the flow works on every instance. The link is matched by href
 * (post.php?...&action=edit), so it survives locale differences.
 */
async function openEditMedia(page: Page, theme: Theme): Promise<Locator> {
	await applyTheme(page, theme)
	await page.goto('/wp-admin/upload.php', { waitUntil: 'networkidle' })
	await stabilize(page)

	// A plain tile click opens the edit modal (MediaFrame.Manage runs
	// modes grid+edit). Fixture 1 is the first tile — the grid queries
	// date DESC and the mu-plugin seeds distinct pinned dates.
	await page
		.locator('.attachments > .attachment .attachment-preview')
		.first()
		.click()
	await expect(
		page.locator('.media-modal-content .edit-attachment-frame'),
	).toBeVisible()

	const editLink = page
		.locator('.attachment-info .actions a[href*="post.php"]')
		.first()
	await expect(editLink).toBeVisible()
	await editLink.click()

	await page.waitForURL(/post\.php\?post=\d+&action=edit/)
	await stabilize(page)

	// The preview image loads async — wait for it to decode so the capture
	// isn't mid-paint, then assert WHICH attachment the page shows (the
	// modal's first tile must be the page's subject).
	await page.waitForFunction(() => {
		const img = document.querySelector('.wp_attachment_image img')
		return (
			img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0
		)
	})
	await expect(page.locator('#titlediv #title')).toHaveValue(
		'Attrium Fixture 1',
	)

	return snapshotTarget(page)
}

for (const { theme } of THEMES) {
	test.describe(`theme: ${theme}`, () => {
		test('attachment edit: metabox chrome', async ({ page }) => {
			await openEditMedia(page, theme)
			const dark = theme === 'dark'

			// Structural pins first: the postbox is the card recipe (token
			// surface, hairline border, radius, no shadow), the header keeps
			// a token hairline with token ink, and the submitdiv footer drops
			// core's #f6f7f7 band for a transparent surface.
			const chrome = await page.evaluate(() => {
				const box = document.querySelector('#poststuff .postbox')
				const header = document.querySelector('.postbox-header')
				const hndle = document.querySelector('.postbox-header .hndle')
				const footer = document.querySelector('#major-publishing-actions')
				const title = document.querySelector('#titlediv #title')
				const slug = document.querySelector('#edit-slug-box')
				const del = document.querySelector('#delete-action a')
				if (!box || !header || !hndle || !footer || !title || !slug) {
					throw new Error('edit form missing')
				}
				const bs = getComputedStyle(box)
				const fs = getComputedStyle(footer)
				const ts = getComputedStyle(title)
				return {
					box: {
						bg: bs.backgroundColor,
						border: `${bs.borderTopWidth} ${bs.borderTopStyle}`,
						borderColor: bs.borderTopColor,
						radius: bs.borderRadius,
						shadow: bs.boxShadow,
					},
					headerBorder: getComputedStyle(header).borderBottomColor,
					hndle: getComputedStyle(hndle).color,
					footer: {
						bg: fs.backgroundColor,
						border: `${fs.borderTopWidth} ${fs.borderTopStyle}`,
						borderColor: fs.borderTopColor,
					},
					titleBg: ts.backgroundColor,
					slug: getComputedStyle(slug).color,
					prompt: getComputedStyle(
						document.querySelector('#title-prompt-text')!,
					).color,
					delete: del ? getComputedStyle(del).color : 'missing',
				}
			})

			// Exact token pins — "not transparent" is not enough: in LIGHT mode
			// core's hardcoded #fff and the token's oklch(0.985) are near
			// indistinguishable, so only the exact value catches a removal
			// that lets core's slab back through.
			expect(chrome.box.bg).toBe(dark ? 'oklch(0.205 0 0)' : 'oklch(0.985 0 0)')
			expect(chrome.box.border).toBe('1px solid')
			expect(chrome.box.borderColor).toBe(
				dark ? 'oklch(1 0 0 / 0.1)' : 'oklch(0.922 0 0)',
			)
			expect(chrome.box.radius).toBe('8px')
			expect(chrome.box.shadow).toBe('none')
			expect(chrome.footer.bg).toBe('rgba(0, 0, 0, 0)')
			expect(chrome.footer.border).toBe('1px solid')
			expect(chrome.footer.borderColor).toBe(
				dark ? 'oklch(1 0 0 / 0.1)' : 'oklch(0.922 0 0)',
			)
			expect(chrome.titleBg).toBe('rgba(0, 0, 0, 0)')

			// Token values: light and dark must resolve to their mode's ink.
			// Dark hndle text resolves to plain white — _base.scss's
			// `#attrium-host.dark h1,h2,h3` rule wins the cascade by ID
			// specificity, which is the repo's shared dark-heading design.
			expect(chrome.hndle).toBe(
				dark ? 'rgb(255, 255, 255)' : 'oklch(0.145 0 0)',
			)
			expect(chrome.delete).toBe(
				dark ? 'rgb(248, 113, 113)' : 'rgb(239, 68, 68)',
			)
			// Placeholder overlay ("Enter title here") and the permalink hint:
			// both muted (core hardcodes #646970 on both; the prompt is hidden
			// while the title is filled, so its computed color is the pin).
			expect(chrome.slug).toBe(dark ? 'oklch(0.708 0 0)' : 'oklch(0.556 0 0)')
			expect(chrome.prompt).toBe(dark ? 'oklch(0.708 0 0)' : 'oklch(0.556 0 0)')

			// The preview thumbnail is framed like the modal's image.
			const thumb = await page
				.locator('.wp_attachment_image img')
				.first()
				.evaluate((el) => {
					const cs = getComputedStyle(el)
					return {
						radius: cs.borderRadius,
						border: `${cs.borderTopWidth} ${cs.borderTopStyle}`,
						borderColor: cs.borderTopColor,
					}
				})
			expect(thumb.radius).toBe('8px')
			expect(thumb.border).toBe('1px solid')
			expect(thumb.borderColor).toBe(
				dark ? 'oklch(1 0 0 / 0.1)' : 'oklch(0.922 0 0)',
			)

			// Classic editor well: the container IS the field — rounded, token
			// hairline, overflow-hidden (so the quicktags band clips to the
			// radius), recessed surface — and the textarea is a flat fill
			// inside it (no border, no vestigial radius, no focus ring; the
			// well's focus-within border carries focus instead).
			const editor = await page.evaluate(() => {
				const container = document.querySelector('.wp-editor-container')
				const toolbar = document.querySelector('.quicktags-toolbar')
				const area = document.querySelector('.wp-editor-area')
				if (!container || !toolbar || !area) {
					throw new Error('editor missing')
				}
				const cs = getComputedStyle(container)
				const ts = getComputedStyle(toolbar)
				const as = getComputedStyle(area)
				return {
					container: {
						border: `${cs.borderTopWidth} ${cs.borderTopStyle}`,
						borderColor: cs.borderTopColor,
						radius: cs.borderRadius,
						overflow: cs.overflow,
						bg: cs.backgroundColor,
					},
					toolbar: {
						bg: ts.backgroundColor,
						hairline: `${ts.borderBottomWidth} ${ts.borderBottomStyle}`,
					},
					area: {
						border: `${as.borderTopWidth} ${as.borderTopStyle}`,
						radius: as.borderRadius,
					},
				}
			})
			expect(editor.container.border).toBe('1px solid')
			expect(editor.container.borderColor).toBe(
				dark ? 'oklch(1 0 0 / 0.1)' : 'oklch(0.922 0 0)',
			)
			expect(editor.container.radius).toBe('8px')
			expect(editor.container.overflow).toBe('hidden')
			expect(editor.container.bg).toBe(
				dark ? 'oklch(0.235 0 0)' : 'oklch(0.965 0 0)',
			)
			expect(editor.toolbar.bg).toBe('rgba(0, 0, 0, 0)')
			expect(editor.toolbar.hairline).toBe('1px solid')
			expect(editor.area.border).toBe('0px none')
			expect(editor.area.radius).toBe('0px')

			// Focus lands on the WELL: the textarea has no ring of its own
			// (core gives it no border to decorate; the module's ring would
			// double the well's arm), and the well's border flips to the
			// ring token while the field is focused.
			await page.locator('#attachment_content').focus()
			const focus = await page.evaluate(() => {
				const container = document.querySelector('.wp-editor-container')
				const area = document.querySelector('.wp-editor-area')
				if (!container || !area) throw new Error('editor missing')
				return {
					wellBorder: getComputedStyle(container).borderTopColor,
					areaShadow: getComputedStyle(area).boxShadow,
					areaOutline: getComputedStyle(area).outlineStyle,
				}
			})
			expect(focus.wellBorder).toBe(
				dark ? 'oklch(0.556 0 0)' : 'oklch(0.708 0 0)',
			)
			expect(focus.areaShadow).toBe('none')
			expect(focus.areaOutline).toBe('none')

			// Lucide swaps. Misc-pub rows: core's dashicons glyphs (calendar
			// on the timestamp, user on uploaded-by) are replaced by
			// mask-inline data-URIs — the glyph is gone (content ''), the
			// mask paints.
			const rowIcons = await page.evaluate(() => {
				const read = (el: Element | null, pseudo: string) =>
					el
						? {
								glyph: getComputedStyle(el, pseudo).maskImage,
								content: getComputedStyle(el, pseudo).content,
								size: getComputedStyle(el, pseudo).width,
								position: getComputedStyle(el, pseudo).maskPosition,
								repeat: getComputedStyle(el, pseudo).maskRepeat,
								ink: getComputedStyle(el, pseudo).color,
							}
						: { glyph: '', content: 'missing', size: '' }
				return {
					timestamp: read(
						document.querySelector('.curtime #timestamp'),
						'::before',
					),
					uploadedby: read(
						document.querySelector('.misc-pub-uploadedby'),
						'::before',
					),
				}
			})
			for (const icon of [rowIcons.timestamp, rowIcons.uploadedby]) {
				expect(icon.content).toBe('""')
				expect(icon.size).toBe('16px')
				expect(icon.glyph).toContain('data:image/svg+xml')
				// mask() geometry: the glyph is centered and non-repeating
				// in its inline-block box (Chromium resolves `center` to
				// "50% 50%" in computed style).
				expect(icon.position).toBe('50% 50%')
				expect(icon.repeat).toBe('no-repeat')
				// The mask inks currentColor — the pseudo's color IS the icon's
				// paint, and core paints #8c8f94 directly on both pseudos
				// (edit.css), so only the exact token catches a removal.
				expect(icon.ink).toBe(dark ? 'oklch(0.708 0 0)' : 'oklch(0.556 0 0)')
			}
			expect(rowIcons.timestamp.glyph).not.toBe(rowIcons.uploadedby.glyph)

			// The row ink: misc-pub sections are muted with the value lifted
			// to foreground (core leaves the section at inherited body ink).
			// Core's markup: the date is a <b> inside #timestamp (not a
			// <strong>), the author name is a <strong> in the uploaded-by row.
			const row = await page.evaluate(() => {
				const section = document.querySelector('.misc-pub-section.curtime')
				const date = document.querySelector('#timestamp b')
				const label = document.querySelector('.misc-pub-uploadedby strong')
				if (!section || !date || !label) {
					throw new Error('misc-pub rows missing')
				}
				return {
					ink: getComputedStyle(section).color,
					date: getComputedStyle(date).color,
					label: getComputedStyle(label).color,
				}
			})
			expect(row.ink).toBe(dark ? 'oklch(0.708 0 0)' : 'oklch(0.556 0 0)')
			// The <b> date inherits the row's muted ink (only <strong> is
			// lifted by the SCSS rule — a deliberate discrimination).
			expect(row.date).toBe(row.ink)
			expect(row.label).toBe(dark ? 'oklch(0.985 0 0)' : 'oklch(0.145 0 0)')

			// Postbox handle indicators: core's dashicons on the :before are
			// hidden, Lucide masks on the :after, and the two order buttons
			// carry different glyphs. The PAINT is pinned too — the mask
			// inks currentColor, and core paints `.toggle-indicator`
			// DIRECTLY (color: #646970/#787c82), which beat the inherited
			// button color and rendered the toggle invisible on the dark
			// card (the "icon buttons are gone" regression). The ::after
			// background must resolve to the mode's foreground token.
			const handles = await page.evaluate(() => {
				const read = (el: Element | null) =>
					el
						? {
								before: getComputedStyle(el, '::before').display,
								glyph: getComputedStyle(el, '::after').maskImage,
								paint: getComputedStyle(el, '::after').backgroundColor,
								// The 20px relative box (size-5) is the ::after
								// overlay's containing block — core gives the
								// span no box of its own, so the icon's
								// geometry lives HERE.
								position: getComputedStyle(el).position,
								box: [el.offsetWidth, el.offsetHeight],
								// The ::after only renders with explicit content
								// — without it the pseudo is never generated.
								afterContent: getComputedStyle(el, '::after').content,
								disabled:
									el.closest('button')?.getAttribute('aria-disabled') ===
									'true',
							}
						: {
								before: 'missing',
								glyph: '',
								paint: '',
								position: '',
								box: [0, 0],
								afterContent: '',
								disabled: false,
							}
				return {
					higher: read(document.querySelector('.order-higher-indicator')),
					lower: read(document.querySelector('.order-lower-indicator')),
					toggle: read(document.querySelector('.toggle-indicator')),
				}
			})
			const foreground = dark ? 'oklch(0.985 0 0)' : 'oklch(0.145 0 0)'
			const muted = dark ? 'oklch(0.708 0 0)' : 'oklch(0.556 0 0)'
			for (const handle of [handles.higher, handles.lower, handles.toggle]) {
				expect(handle.before).toBe('none')
				expect(handle.glyph).toContain('data:image/svg+xml')
				expect(handle.position).toBe('relative')
				expect(handle.box).toEqual([20, 20])
				expect(handle.afterContent).toBe('""')
				// Disabled order buttons (the first metabox can't move up)
				// keep the muted ink; everything else paints foreground.
				expect(handle.paint).toBe(handle.disabled ? muted : foreground)
			}
			expect(handles.higher.glyph).not.toBe(handles.lower.glyph)

			await expect(page).toHaveScreenshot(`attachment-edit-${theme}.png`)

			// Keyboard focus on a handle: core paints an inset #2271b1 ring
			// on .handlediv:focus / .handle-order-*:focus (common.css) — the
			// flex-centered indicator carries the visual weight instead, so
			// the ring must stay killed. Focus is never in the pixel
			// capture (and .focus() scrolls, which would shift the shot),
			// so the computed style is the pin, run after the capture.
			const focusShadow = await page.evaluate(() => {
				const btn = document.querySelector<HTMLButtonElement>(
					'.postbox .handlediv',
				)
				if (!btn) throw new Error('handlediv missing')
				btn.focus()
				const shadow = getComputedStyle(btn).boxShadow
				btn.blur()
				return shadow
			})
			expect(focusShadow).toBe('none')

			// Collapsing a postbox flips its toggle chevron down (core's own
			// f142/f140 semantics, mirrored by the Lucide swap on
			// .postbox.closed). The open-state glyph is pinned above; the
			// closed state must paint the other mask. The class is toggled
			// DIRECTLY, not via a click: postbox.js persists the collapsed
			// state to user meta over AJAX, which would leak across test
			// runs — and the hidden state is never in the pixel capture, so
			// this probe runs after the screenshot.
			const closedGlyph = await page.evaluate(() => {
				const box = document.querySelector<HTMLElement>('.postbox')
				if (!box) throw new Error('postbox missing')
				box.classList.add('closed')
				const indicator = box.querySelector<HTMLElement>(
					'.handlediv .toggle-indicator',
				)
				if (!indicator) throw new Error('toggle indicator missing')
				const glyph = getComputedStyle(indicator, '::after').maskImage
				box.classList.remove('closed')
				return glyph
			})
			expect(closedGlyph).toContain('data:image/svg+xml')
			expect(closedGlyph).not.toBe(handles.toggle.glyph)
		})

		test('attachment edit: image editor toolbar swaps glyphs', async ({
			page,
		}) => {
			await openEditMedia(page, theme)
			const dark = theme === 'dark'

			// "Edit Image" (an input[type=button]) opens the image editor via
			// imageEdit.open — an AJAX panel rendered into .image-editor.
			await page.locator('.wp_attachment_image input[type=button]').click()
			const tools = page.locator('.imgedit-menu')
			await expect(tools.locator('.imgedit-crop')).toBeVisible()

			const glyphs = await page.evaluate(() => {
				const read = (selector: string) => {
					const el = document.querySelector(selector)
					if (!el) throw new Error(`${selector} missing`)
					const cs = getComputedStyle(el, '::before')
					return {
						glyph: cs.maskImage,
						content: cs.content,
						size: cs.width,
					}
				}
				return {
					crop: read('.imgedit-menu .imgedit-crop'),
					scale: read('.imgedit-menu .imgedit-scale'),
					rotate: read('.imgedit-menu .imgedit-rotate'),
					undo: read('.imgedit-menu .imgedit-undo'),
					redo: read('.imgedit-menu .imgedit-redo'),
				}
			})

			// Every tool button's dashicon glyph is replaced by a Lucide
			// mask; undo and redo (disabled at rest) still paint — the mask
			// tracks the button's currentColor, dimmed by :disabled opacity.
			for (const tool of [
				glyphs.crop,
				glyphs.scale,
				glyphs.rotate,
				glyphs.undo,
				glyphs.redo,
			]) {
				expect(tool.content).toBe('""')
				expect(tool.size).toBe('16px')
				expect(tool.glyph).toContain('data:image/svg+xml')
			}
			expect(glyphs.undo.glyph).not.toBe(glyphs.redo.glyph)
			expect(glyphs.rotate.glyph).not.toBe(glyphs.crop.glyph)

			// Core paints `text-shadow: 0 1px 0 #fff` on the disabled imgedit
			// buttons (media.css .imgedit-menu .button.disabled) — a white
			// glow under the label. None of the image-editor buttons may
			// carry a text shadow (disabled or not).
			const shadows = await page.evaluate(() =>
				[...document.querySelectorAll('.imgedit-menu .button')].map(
					(b) => getComputedStyle(b).textShadow,
				),
			)
			expect(shadows.length).toBeGreaterThan(0)
			for (const shadow of shadows) {
				expect(shadow).toBe('none')
			}

			// The rotate popup: the caret flips (aria-expanded) and the
			// popup itself wears the card surface, not core's #fff.
			const rotate = page.locator('.imgedit-menu .imgedit-rotate.button')
			const caretClosed = await rotate.evaluate(
				(el) => getComputedStyle(el, '::after').maskImage,
			)
			// The closed caret must be the Lucide mask itself (core paints a
			// dashicon \f140 on .imgedit-rotate.button:after — its maskImage
			// computes to 'none'), and the expanded caret flips glyphs.
			expect(caretClosed).toContain('data:image/svg+xml')
			await rotate.click()
			await expect(
				page.locator('.imgedit-menu .imgedit-rotate[aria-expanded="true"]'),
			).toBeAttached()
			const popup = await page.evaluate(() => {
				const caret = getComputedStyle(
					document.querySelector('.imgedit-rotate.button')!,
					'::after',
				).maskImage
				const menu = document.querySelector('.imgedit-popup-menu')
				return {
					caret,
					popupBg: menu ? getComputedStyle(menu).backgroundColor : '',
				}
			})
			expect(popup.caret).not.toBe(caretClosed)
			expect(popup.popupBg).not.toBe('rgba(0, 0, 0, 0)')

			// The crop canvas is rounded: both the checkerboard wrap and the
			// preview img take the token radius (the wrap keeps no overflow
			// clipping so the imgareaselect overlay divs — selection
			// border/handles — still paint along edges).
			const canvas = await page.evaluate(() => {
				const wrap = document.querySelector('.imgedit-crop-wrap')
				const img = document.querySelector('.imgedit-crop-wrap img')
				if (!wrap || !img) throw new Error('crop canvas missing')
				return {
					wrap: getComputedStyle(wrap).borderRadius,
					img: getComputedStyle(img).borderRadius,
					wrapOverflow: getComputedStyle(wrap).overflow,
					wrapBg: getComputedStyle(wrap).backgroundImage,
				}
			})
			expect(canvas.wrap).toBe('8px')
			expect(canvas.img).toBe('8px')
			expect(canvas.wrapOverflow).not.toBe('hidden')
			// The checkerboard is the wrap's own background, tokenized — core
			// paints #c3c4c7 squares directly on the wrap, so the computed
			// gradient must carry the mode's token (not core's rgb).
			expect(canvas.wrapBg).toContain('linear-gradient(45deg')
			expect(canvas.wrapBg).toContain(
				dark ? 'oklch(1 0 0 / 0.1)' : 'oklch(0.922 0 0)',
			)

			// The popup's <hr> separator: one token hairline, not core's
			// global double line (#dcdcde + #f6f7f7 — two bright lines on
			// the dark card).
			const hr = await page.evaluate(() => {
				const el = document.querySelector('.imgedit-popup-menu hr')
				if (!el) throw new Error('popup hr missing')
				const cs = getComputedStyle(el)
				return {
					top: `${cs.borderTopWidth} ${cs.borderTopStyle}`,
					bottom: cs.borderBottomWidth,
					color: cs.borderTopColor,
				}
			})
			expect(hr.top).toBe('1px solid')
			expect(hr.bottom).toBe('0px')
			expect(hr.color).toBe(dark ? 'oklch(1 0 0 / 0.1)' : 'oklch(0.922 0 0)')
		})

		test('attachment edit: rotate popup menu', async ({ page }) => {
			await openEditMedia(page, theme)
			const dark = theme === 'dark'

			// "Edit Image" opens the image editor (glyph swaps are pinned by
			// the toolbar test above); this test covers the Image Rotation
			// popup that button toggles. The toolbar is the FIRST of core's
			// three .imgedit-menu rows (the submit row and the crop-apply row
			// carry the class too) — .wp-clearfix singles it out.
			await page.locator('.wp_attachment_image input[type=button]').click()
			const tools = page.locator('.imgedit-menu.wp-clearfix')
			await expect(tools.locator('.imgedit-crop')).toBeVisible()

			// The popup starts CLOSED: core server-renders #imgedit-rotate-menu
			// inside the toolbar's rotate container and hides it with
			// `display: none` (media.css), and the toggle carries
			// aria-expanded="false".
			const rotate = tools.locator('.imgedit-rotate')
			await expect(rotate).toHaveAttribute('aria-expanded', 'false')
			const menu = tools.locator('.imgedit-popup-menu')
			await expect(menu).not.toBeVisible()

			// Toggle: imageEdit.togglePopup adds .imgedit-popup-menu-open and
			// slideToggles the menu open (three rotate buttons, an <hr>, two
			// flips), flipping the caret state on the button.
			await rotate.click()
			await expect(menu).toBeVisible()
			await expect(rotate).toHaveAttribute('aria-expanded', 'true')
			await expect(menu).toHaveClass(/imgedit-popup-menu-open/)
			expect(await menu.locator('button').count()).toBe(5)

			// Popup surface: the card recipe again (core hardcodes #fff +
			// its own shadow; the recipe's radius/border are the pin).
			const popup = await menu.evaluate((el) => {
				const cs = getComputedStyle(el)
				return {
					bg: cs.backgroundColor,
					border: `${cs.borderTopWidth} ${cs.borderTopStyle}`,
					borderColor: cs.borderTopColor,
					radius: cs.borderRadius,
				}
			})
			expect(popup.bg).toBe(dark ? 'oklch(0.205 0 0)' : 'oklch(0.985 0 0)')
			expect(popup.border).toBe('1px solid')
			expect(popup.borderColor).toBe(
				dark ? 'oklch(1 0 0 / 0.1)' : 'oklch(0.922 0 0)',
			)
			expect(popup.radius).toBe('8px')

			// The menu's five buttons: the rotate/flip group in DOM order.
			// Core paints NO glyphs on these buttons (media.css styles them
			// text-only — the Lucide swap in _attachment-edit.scss lives on
			// the toolbar's tool buttons and the toggle caret), so pin the
			// group by class: the popup must expose exactly the five
			// actions, nothing more.
			const menuButtons = await menu.evaluate((el) =>
				[...el.querySelectorAll('button')].map((b) => b.className),
			)
			expect(menuButtons).toHaveLength(5)
			for (const [index, cls] of [
				'imgedit-rleft',
				'imgedit-rright',
				'imgedit-rfull',
				'imgedit-flipv',
				'imgedit-fliph',
			].entries()) {
				expect(menuButtons[index]).toContain(cls)
			}

			await expect(menu).toHaveScreenshot(
				`attachment-edit-rotate-popup-${theme}.png`,
			)

			// Toggling again closes it: the caret flips back and the menu
			// hides (the node stays attached — core only slideToggles it).
			await rotate.click()
			await expect(rotate).toHaveAttribute('aria-expanded', 'false')
			await expect(menu).not.toBeVisible()
		})
	})
}
