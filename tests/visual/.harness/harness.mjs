// Static harness for the Customizer CodeMirror-gutter overlap fix.
// Serves core's real CSS (common/themes/customize-controls/codemirror) plus
// Attrium's compiled chunks, renders the Additional-CSS section DOM shape from
// customize.php + the section template, and measures whether the CodeMirror
// gutter intersects the fixed #customize-footer-actions bar.
//
// Usage: node tests/visual/.harness/harness.mjs
//   OLD=1        inject the pre-fix CSS (bottom:unset) — mutation test, must FAIL
//   VP_W/VP_H    viewport (default 1280x800)
//   WP_TREE      path to the WP tree (default ../../../ = wp-content parent)
// Exit code 0 = no overlap, 1 = overlap (regression).

import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const HERE = dirname(fileURLToPath(import.meta.url)) // tests/visual/.harness
const ROOT = join(HERE, '..', '..', '..') // plugin root
// WP tree lives three levels above the plugin dir (wp-content/plugins/attrium).
const WP = join(ROOT, process.env.WP_TREE || '../../../')
const ATTRIUM_REL = process.env.ATTRIUM || 'wp-content/plugins/attrium'
const ATTRIUM = join(ROOT, ATTRIUM_REL)

const MIME = { '.css': 'text/css', '.html': 'text/html' }

const server = createServer((req, res) => {
	const p = req.url.split('?')[0]
	if (p === '/' || p === '/index.html') {
		res.writeHead(200, { 'content-type': 'text/html' })
		res.end(html)
		return
	}
	let file = null
	if (p.startsWith('/wp/')) file = join(WP, p.slice(4))
	else if (p.startsWith('/attrium/'))
		file = join(ROOT, ATTRIUM_REL, 'app/dist', p.slice('/attrium/'.length))
	if (!file || !readFileSyncSafe(file)) {
		res.writeHead(404)
		res.end('not found: ' + p)
		return
	}
	res.writeHead(200, { 'content-type': MIME[extname(file)] || 'text/plain' })
	res.end(readFileSyncSafe(file))
})

function readFileSyncSafe(f) {
	try {
		return readFileSync(f)
	} catch {
		return null
	}
}

await new Promise((r) => server.listen(0, r))
const port = server.address().port

const bodyClasses =
	process.env.BODY_CLASS || 'wp-customizer attrium-mod-screens'
const width = Number(process.env.VP_W || 1280)
const height = Number(process.env.VP_H || 800)

// DOM shape per core: <form id=customize-controls class="wrap wp-full-overlay-sidebar">
//   #customize-header-actions (wp-full-overlay-header)
//   .wp-full-overlay-sidebar-content
//     #customize-info (accordion-section customize-info)
//     .customize-pane-parent (top-level list)
//     #sub-accordion-section-custom_css.customize-pane-child  (open section pane)
//       li.customize-section-description-container.section-meta.customize-info
//         .customize-section-title > h3
//         .customize-control-notifications-container
//         .description.customize-section-description   (long help text)
//       li#customize-control-custom_css.customize-control
//         .CodeMirror (gutters + scroll)
//   #customize-footer-actions (wp-full-overlay-footer, fixed)
const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/wp/wp-admin/css/common.css">
<link rel="stylesheet" href="/wp/wp-admin/css/themes.css">
<link rel="stylesheet" href="/wp/wp-admin/css/customize-controls.css">
<link rel="stylesheet" href="/wp/wp-includes/js/codemirror/codemirror.min.css">
<link rel="stylesheet" href="/attrium/admin-theme-base.css">
<link rel="stylesheet" href="/attrium/admin-theme-screens.css">
</head>
<body class="${bodyClasses}">
<div class="wp-full-overlay expanded">
	<form id="customize-controls" class="wrap wp-full-overlay-sidebar">
		<div id="customize-header-actions" class="wp-full-overlay-header">
			<button type="button" class="customize-controls-close"></button>
			<span class="spinner"></span>
			<button type="button" class="customize-controls-preview-toggle"><span class="controls">Customize</span><span class="preview">Preview</span></button>
			<div id="customize-save-button-wrapper"><button type="button" class="save button button-primary">Publish</button></div>
		</div>
		<div class="wp-full-overlay-sidebar-content" tabindex="-1">
			<div id="customize-info" class="accordion-section customize-info">
				<div class="accordion-section-title">Customizing<b class="panel-title">Additional CSS</b></div>
			</div>
			<ul class="customize-pane-parent"></ul>
			<ul id="sub-accordion-section-custom_css" class="customize-pane-child">
				<li class="customize-section-description-container section-meta customize-info">
					<div class="customize-section-title">
						<button class="customize-section-back" tabindex="-1"></button>
						<h3><span class="customize-action">Customizing</span>Additional CSS</h3>
					</div>
					<div class="customize-control-notifications-container"></div>
					<div class="description customize-section-description">
						<p>Add your own CSS code here to customize the appearance of your site. Learn more about CSS.</p>
						<p>When using a keyboard to navigate: In the editing area, the Tab key enters a tab character. To move away from this area, press the Esc key followed by the Tab key.</p>
						<p>Screen reader users: when in forms mode, you may need to press the Esc key twice.</p>
						<p>The edit field automatically highlights code syntax. You can disable this in your user profile to work in plain text mode.</p>
						<a class="external-link" href="#">Close</a>
					</p>
				</li>
				<li id="customize-control-custom_css" class="customize-control customize-control-custom_css">
					<div class="CodeMirror css-editor">
						<div class="CodeMirror-scroll"><div class="CodeMirror-sizer"><div class="CodeMirror-lines"><div><pre class="CodeMirror-line"><span>body { color: red; }</span></pre></div></div></div></div>
						<div class="CodeMirror-gutters"><div class="CodeMirror-gutter"><div class="CodeMirror-linenumber">1</div></div></div>
					</div>
				</li>
			</ul>
		</div>
	</form>
	<div id="customize-footer-actions" class="wp-full-overlay-footer">
		<button type="button" class="collapse-sidebar"><span class="collapse-sidebar-arrow"></span><span class="collapse-sidebar-label">Hide Controls</span></button>
		<div class="devices-wrapper"><div class="devices"><button type="button" class="preview-desktop active"></button><button type="button" class="preview-tablet"></button><button type="button" class="preview-mobile"></button></div></div>
	</div>
</div>
</body>
</html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width, height } })

// OLD=1 replicates the pre-fix CSS (bottom:unset) — mutation test.
if (process.env.OLD === '1') {
	await page.addInitScript(() => {
		document.addEventListener('DOMContentLoaded', () => {
			const s = document.createElement('style')
			s.textContent =
				'.wp-full-overlay-sidebar-content{top:unset!important;bottom:unset!important}'
			document.head.appendChild(s)
		})
	})
}

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' })

const result = await page.evaluate(() => {
	const scroller = document.querySelector('.wp-full-overlay-sidebar-content')
	const gutter = document.querySelector('.CodeMirror-gutters')
	const footer = document.querySelector('#customize-footer-actions')
	const editor = document.querySelector('.CodeMirror')
	const s = scroller.getBoundingClientRect()
	const f = footer.getBoundingClientRect()
	const g = gutter ? gutter.getBoundingClientRect() : null
	return {
		scroller: { top: s.top, bottom: s.bottom, height: s.height },
		footer: {
			top: f.top,
			bottom: f.bottom,
			display: getComputedStyle(footer).display,
		},
		gutter: g ? { top: g.top, bottom: g.bottom } : null,
		editorBottom: editor ? editor.getBoundingClientRect().bottom : null,
		editorRect: editor
			? (({ top, bottom, height }) => ({ top, bottom, height }))(
					editor.getBoundingClientRect(),
				)
			: null,
		control: (({ top, bottom }) => ({ top, bottom }))(
			document
				.querySelector('#customize-control-custom_css')
				.getBoundingClientRect(),
		),
		pane: (({ top, bottom, scrollHeight }) => ({ top, bottom, scrollHeight }))(
			document
				.querySelector('#sub-accordion-section-custom_css')
				.getBoundingClientRect(),
		),
		controlCss: (() => {
			const el = document.querySelector('#customize-control-custom_css')
			const cs = getComputedStyle(el)
			return {
				height: cs.height,
				mb: cs.marginBottom,
				ml: cs.marginLeft,
				w: cs.width,
			}
		})(),
		editorHeightCss: (() => {
			const el = document.querySelector(
				'#customize-control-custom_css .CodeMirror',
			)
			const cs = getComputedStyle(el)
			return { h: cs.height, pos: cs.position, mb: cs.marginBottom }
		})(),
		// Core's own geometry is flush-to-1px-overlap (footer = 45px + border).
		// Only flag real incursions; the load-bearing signal is the gutter.
		scrollerUnderFooter: s.bottom > f.top + 2,
		// The gutter paints within the scroller's clip (overflow-y: auto), so its
		// visible bottom is the lesser of its layout bottom and the scroller's
		// edge. If THAT crosses the footer top, the gutter band paints over the
		// fixed footer (gutter z-index:3 beats the z-auto footer).
		visibleGutterBottom: g ? Math.min(g.bottom, s.bottom) : null,
		gutterOverFooter: g ? Math.min(g.bottom, s.bottom) > f.top + 2 : null,
		footerVisible: getComputedStyle(footer).display !== 'none',
	}
})

console.log(JSON.stringify({ viewport: { width, height }, ...result }, null, 2))

let ok = true
if (result.footerVisible) {
	if (result.scrollerUnderFooter) {
		console.error(
			`FAIL: scroller bottom (${result.scroller.bottom.toFixed(1)}) extends below footer top (${result.footer.top.toFixed(1)})`,
		)
		ok = false
	}
	if (result.gutterOverFooter) {
		console.error(
			`FAIL: CodeMirror gutter visible bottom (${result.visibleGutterBottom.toFixed(1)}) overlaps footer top (${result.footer.top.toFixed(1)})`,
		)
		ok = false
	}
} else {
	console.log('footer hidden — overlap checks skipped')
}

await browser.close()
server.close()
process.exit(ok ? 0 : 1)
