// Find Attrium CSS that does nothing: selectors that never match and
// declarations that can't take effect.
//
// Two questions, answered empirically against a live wp-env WordPress:
//   1. DEAD SELECTORS — a rule whose selector matches zero elements on every
//      crawled screen (both themes) styles nothing and can go.
//   2. USELESS DECLARATIONS — a declaration the layout ignores structurally,
//      e.g. `float` on a flex item (computed back to `none`), `z-index`
//      without positioning, or `width` on a non-replaced inline element.
//
// What this deliberately does NOT claim:
//   - Interactive states are not exercised (no hovering, no open menus or
//     modals, no drag states). A selector kept alive only by such a state is
//     reported normally if its base matches; one matching NOTHING is still
//     listed as dead — triage it via the allowlist before deleting.
//   - DOM injected by JavaScript on interaction (theme overlay contents,
//     filter tags, modal dialogs, toasts) is absent at crawl time and also
//     reports dead. If the markup provably renders on interaction, allowlist
//     the selector instead of deleting the rule.
//   - A declaration flagged useless was useless on EVERY sampled element (the
//     first match per page). If it is load-bearing somewhere unsampled, the
//     flag is wrong — the report shows sample counts so you can judge.
//   - Screens outside tests/visual/pages.ts (block/site editor) are not
//     crawled; customize.php is added explicitly (no shell there, but selector
//     matching needs none).
//
// Usage:
//   bun run build:css                                    # fresh dist first
//   bun run wp-env start                                 # script won't do it
//   bun scripts/check-css-coverage.mjs [options]
//
// Options:
//   --base-url <url>   WP base URL (default http://localhost:8888)
//   --grep <substr>    only crawl pages whose name includes substr
//   --allowlist <file> selectors to suppress (default
//                      scripts/css-coverage-allowlist.txt when present)
//   --json             machine-readable report on stdout
//   --strict           exit 1 when dead selectors or useless declarations
//                      remain (for CI, once the backlog is empty)
//   --build            run build:css before checking
//   --help             this text

import { execSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'
import { ADMIN_PAGES } from '../tests/visual/pages.ts'

const root = path.resolve(import.meta.dir, '..')
const DIST = path.join(root, 'app', 'dist')
const DEFAULT_ALLOWLIST = path.join(
	root,
	'scripts',
	'css-coverage-allowlist.txt',
)

// Screens with Attrium CSS that pages.ts deliberately omits (overlay screens
// have no shell, but selector matching needs no shell — just the DOM).
const EXTRA_PAGES = [
	{ name: 'customize', path: '/wp-admin/customize.php' },
	// Grid is upload.php's default landing mode; list-mode-only selectors
	// (.filter-items bar etc.) would otherwise false-positive as dead.
	{ name: 'upload-list', path: '/wp-admin/upload.php?mode=list' },
]

// Pseudo-elements whose box can be inspected via getComputedStyle(el, name).
// Anything else (selection, backdrop, …) is match-tested only.
const PROBEABLE_PSEUDOS = new Set([
	'before',
	'after',
	'first-line',
	'first-letter',
	'marker',
	'placeholder',
])

// The inspected box for a selector: a pseudo-element's own box when the
// selector targets one (its display comes from the full cascade, not the
// host), otherwise the element itself.
function probePseudo(raw) {
	const found = []
	const re = /::?(before|after|first-line|first-letter|marker|placeholder)\b/gi
	for (const match of raw.matchAll(re)) {
		found.push(match[1].toLowerCase())
	}
	const unique = [...new Set(found)]
	if (unique.length !== 1 || !PROBEABLE_PSEUDOS.has(unique[0])) return null
	return `::${unique[0]}`
}

// Pseudo-classes that depend on transient user interaction. Stripped for
// match-testing (the base either matches or the rule is dead); the selector
// is reported as dynamic so state coverage stays an explicit caveat.
const DYNAMIC_PSEUDOS = new Set([
	':hover',
	':focus',
	':focus-within',
	':focus-visible',
	':active',
	':visited',
	':target',
])

// Single-colon pseudo-elements (legacy syntax).
const LEGACY_PSEUDO_ELEMENTS = new Set([
	':before',
	':after',
	':first-line',
	':first-letter',
])

// Tags where width/height declarations DO apply despite display:inline.
const REPLACED_TAGS = new Set([
	'IMG',
	'VIDEO',
	'CANVAS',
	'INPUT',
	'TEXTAREA',
	'SELECT',
	'BUTTON',
	'IFRAME',
	'EMBED',
	'OBJECT',
	'SVG',
])

function usage(exit = 0) {
	const text = readFileSync(new URL(import.meta.url), 'utf8')
	const start = text.indexOf('\n// Usage:')
	const end = text.indexOf('\nimport ', start)
	console.log(
		text
			.slice(start, end)
			.split('\n')
			.map((line) => line.replace(/^\/\/ ?/, ''))
			.join('\n')
			.trim(),
	)
	process.exit(exit)
}

function parseArgs(argv) {
	const opts = {
		baseUrl: process.env.WP_BASE_URL ?? 'http://localhost:8888',
		grep: null,
		allowlist: existsSync(DEFAULT_ALLOWLIST) ? DEFAULT_ALLOWLIST : null,
		json: false,
		strict: false,
		build: false,
	}
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]
		if (arg === '--help' || arg === '-h') usage(0)
		else if (arg === '--base-url') opts.baseUrl = argv[++i]
		else if (arg === '--grep') opts.grep = argv[++i]
		else if (arg === '--allowlist') opts.allowlist = argv[++i]
		else if (arg === '--json') opts.json = true
		else if (arg === '--strict') opts.strict = true
		else if (arg === '--build') opts.build = true
		else {
			console.error(`unknown argument: ${arg}`)
			usage(1)
		}
	}
	if (!opts.baseUrl) {
		console.error('--base-url needs a value')
		usage(1)
	}
	return opts
}

// Split one rule's selector list and sanitize each for match-testing.
// Returns [{ raw, test, dynamic, skip }]: `test` is the queryable form (null
// when nothing queryable remains), `dynamic` marks stripped interaction
// state, `skip` marks selectors that can't be evaluated at all.
function sanitizeSelectors(rawSelector) {
	// An empty functional pseudo in the SOURCE (`:not()`) is invalid CSS —
	// surfacing it as skipped beats silently testing the remainder.
	if (/:(not|is|where|has|matches|any)\(\s*\)/.test(rawSelector)) {
		return [{ raw: rawSelector, test: null, dynamic: false, skip: true }]
	}
	const out = []
	const each = (selectors) => {
		selectors.each((sel) => {
			const original = sel.toString()
			// `:host` only matches from inside a shadow root, which a
			// document-level query can never do — the shell's own host
			// rules. Other branches of the same rule still test.
			if (/:host\b/.test(original)) {
				out.push({ raw: original, test: null, dynamic: false, skip: true })
				return
			}
			let dynamic = false
			sel.walk((node) => {
				if (node.type !== 'pseudo') return
				const value = node.value.toLowerCase()
				if (node.value.startsWith('::') || LEGACY_PSEUDO_ELEMENTS.has(value)) {
					node.remove()
					return
				}
				if (DYNAMIC_PSEUDOS.has(value)) {
					dynamic = true
					node.remove()
					return
				}
			})
			// A functional pseudo emptied by stripping (e.g. :not(:hover))
			// is invalid CSS — prune the husk so the remainder still tests.
			// Plain pseudo-classes also carry an (empty) nodes array, so only
			// touch nodes that actually wrap selector children.
			let pruned = true
			while (pruned) {
				pruned = false
				sel.walk((node) => {
					if (pruned || node.type !== 'pseudo' || !node.nodes) return
					const inners = node.nodes.filter((n) => n.type === 'selector')
					if (inners.length === 0) return
					if (inners.every((n) => (n.nodes || []).length === 0)) {
						dynamic = true
						node.remove()
						pruned = true
					}
				})
			}
			const test = sel.toString().trim()
			if (!test) {
				out.push({ raw: original, test: null, dynamic, skip: true })
				return
			}
			out.push({ raw: original, test, dynamic, skip: false })
		})
	}
	try {
		selectorParser(each).processSync(rawSelector)
	} catch {
		// Unparseable as a whole (e.g. a nesting- or vendor-specific form):
		// keep one entry so the report can show it instead of dropping it.
		return [{ raw: rawSelector, test: null, dynamic: false, skip: true }]
	}
	return out
}

// Walk every chunk once. Returns Map<rawSelector, { files, media, decls,
// dynamic }> with declarations merged across occurrences.
function collectRules() {
	const files = readdirSync(DIST)
		.filter((f) => f.startsWith('admin-theme-') && f.endsWith('.css'))
		.sort()
	const rules = new Map()
	for (const file of files) {
		const css = readFileSync(path.join(DIST, file), 'utf8')
		const ast = postcss.parse(css)
		ast.walkRules((rule) => {
			const media = []
			let parent = rule.parent
			let inKeyframes = false
			while (parent && parent.type !== 'root') {
				if (parent.type === 'atrule') {
					if (parent.name.toLowerCase().includes('keyframes'))
						inKeyframes = true
					else media.push(`@${parent.name} ${parent.params}`)
				}
				parent = parent.parent
			}
			if (inKeyframes) return // from/to/%: not selectors, never match
			const decls = new Map()
			rule.walkDecls((decl) => {
				decls.set(decl.prop.toLowerCase(), decl.value)
			})
			if (decls.size === 0) return
			for (const s of sanitizeSelectors(rule.selector)) {
				const key = s.raw
				let entry = rules.get(key)
				if (!entry) {
					entry = {
						files: new Set(),
						media: new Set(),
						decls: new Map(),
						dynamic: false,
					}
					rules.set(key, entry)
				}
				entry.files.add(file)
				for (const m of media) entry.media.add(m)
				for (const [prop, value] of decls) {
					if (!entry.decls.has(prop)) entry.decls.set(prop, new Set())
					entry.decls.get(prop).add(value)
				}
				entry.dynamic = entry.dynamic || s.dynamic
				// Same raw string always sanitizes identically; first wins.
				entry.test = entry.test ?? s.test
				entry.pseudo = entry.pseudo ?? probePseudo(key)
				if (s.skip && !entry.test) entry.skip = true
			}
		})
	}
	return rules
}

function loadAllowlist(file) {
	if (!file) return new Set()
	const lines = readFileSync(file, 'utf8').split('\n')
	const set = new Set()
	for (const line of lines) {
		const trimmed = line.trim()
		if (!trimmed || trimmed.startsWith('#')) continue
		set.add(trimmed.replace(/\s+/g, ' '))
	}
	return set
}

function warnIfStale() {
	let newestScss = 0
	const scan = (dir) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (entry.name.startsWith('.')) continue
			const full = path.join(dir, entry.name)
			if (entry.isDirectory()) scan(full)
			else if (full.endsWith('.scss')) {
				newestScss = Math.max(newestScss, statSync(full).st_mtimeMs)
			}
		}
	}
	scan(path.join(root, 'scss'))
	let oldestCss = Infinity
	for (const f of readdirSync(DIST)) {
		if (f.startsWith('admin-theme-') && f.endsWith('.css')) {
			oldestCss = Math.min(oldestCss, statSync(path.join(DIST, f)).st_mtimeMs)
		}
	}
	if (newestScss > oldestCss) {
		console.error(
			'warning: scss/ is newer than app/dist — run `bun run build:css` first (or --build).',
		)
	}
}

async function login(page, baseUrl) {
	const user = process.env.WP_ADMIN_USER ?? 'admin'
	const pass = process.env.WP_ADMIN_PASS ?? 'password'
	await page.goto(`${baseUrl}/wp-login.php`)
	await page.locator('#user_login').fill(user)
	await page.locator('#user_pass').fill(pass)
	await page.locator('#wp-submit').click()
	await page.waitForURL(/wp-admin/)
	await page.locator('#wpadminbar').waitFor({ state: 'attached' })
}

// One round trip per (page, theme): match counts for every selector, then
// useless-declaration flags for a sample of the matched ones.
async function probePage(context, pageInfo, payload) {
	const page = await context.newPage()
	try {
		await page.goto(pageInfo.path, { waitUntil: 'networkidle' })
		// Shell signal when present; overlay screens (customize) have none —
		// selector matching needs no shell, so never fail the crawl here.
		await page
			.waitForFunction(
				() => !document.getElementById('attrium-body-hider'),
				null,
				{
					timeout: 15000,
				},
			)
			.catch(() => {})
		// JS-rendered content (media grid tiles, editor panes) lands after
		// networkidle via admin-ajax: wait for DOM childList calm instead of
		// a fixed sleep, or attachment tiles flip dead/alive between runs.
		// Attributes/text are excluded — heartbeat touches those constantly.
		await page
			.waitForFunction(
				() =>
					new Promise((resolve) => {
						let timer = setTimeout(resolve, 800)
						new MutationObserver(() => {
							clearTimeout(timer)
							timer = setTimeout(resolve, 800)
						}).observe(document.documentElement, {
							childList: true,
							subtree: true,
						})
					}),
				null,
				{ timeout: 10000 },
			)
			.catch(() => {})
		return await page.evaluate((input) => {
			const REPLACED = new Set([
				'IMG',
				'VIDEO',
				'CANVAS',
				'INPUT',
				'TEXTAREA',
				'SELECT',
				'BUTTON',
				'IFRAME',
				'EMBED',
				'OBJECT',
				'SVG',
			])
			const roots = [document]
			const seen = new Set()
			const collect = (root) => {
				for (const el of root.querySelectorAll('*')) {
					if (el.shadowRoot && !seen.has(el.shadowRoot)) {
						seen.add(el.shadowRoot)
						roots.push(el.shadowRoot)
						collect(el.shadowRoot)
					}
				}
			}
			collect(document)
			const counts = {}
			const useless = []
			const rejected = []
			for (const item of input) {
				let total = 0
				let failed = false
				try {
					for (const r of roots) total += r.querySelectorAll(item.test).length
				} catch {
					failed = true
				}
				if (failed) {
					counts[item.key] = -1
					rejected.push(item.key)
					continue
				}
				counts[item.key] = total
				if (total === 0) continue
				// First rendered match: display:none hosts prove nothing about
				// the declarations (the box isn't generated at all).
				let el = null
				for (const r of roots) {
					for (const candidate of r.querySelectorAll(item.test)) {
						if (getComputedStyle(candidate).display !== 'none') {
							el = candidate
							break
						}
					}
					if (el) break
				}
				if (!el) continue
				// Declarations on a pseudo-element rule style the pseudo box,
				// whose display comes from the full cascade — read it off the
				// pseudo itself, not the host.
				const cs = getComputedStyle(el)
				const ps =
					item.pseudo != null ? getComputedStyle(el, item.pseudo) : null
				const box = ps ?? cs
				const parent = el.parentElement
				const parentDisplay = parent ? getComputedStyle(parent).display : ''
				const isFlexItem =
					parentDisplay === 'flex' || parentDisplay === 'inline-flex'
				const isGridItem =
					parentDisplay === 'grid' || parentDisplay === 'inline-grid'
				const tag = el.tagName
				const where = item.pseudo != null ? ` on ${item.pseudo}` : ''
				for (const decl of item.decls) {
					const prop = decl.prop
					const specified = decl.values[0]
					if (
						prop === 'float' &&
						specified !== 'none' &&
						box.float === 'none' &&
						(isFlexItem ||
							isGridItem ||
							box.position === 'absolute' ||
							box.position === 'fixed')
					) {
						useless.push({
							key: item.key,
							prop,
							reason: `float:${specified} computes to none${where} (${isFlexItem || isGridItem ? 'flex/grid item' : `position:${box.position}`})`,
						})
					} else if (
						prop === 'clear' &&
						specified !== 'none' &&
						(isFlexItem || isGridItem || box.float !== 'none')
					) {
						useless.push({
							key: item.key,
							prop,
							reason: `clear:${specified} has no effect${where} (${isFlexItem || isGridItem ? 'flex/grid item' : `floated ${box.float}`})`,
						})
					} else if (
						prop === 'vertical-align' &&
						![
							'inline',
							'inline-block',
							'inline-flex',
							'inline-grid',
							'inline-table',
							'table-cell',
						].includes(box.display)
					) {
						useless.push({
							key: item.key,
							prop,
							reason: `vertical-align:${specified} has no effect${where} (display:${box.display})`,
						})
					} else if (
						prop === 'z-index' &&
						specified !== 'auto' &&
						box.position === 'static'
					) {
						useless.push({
							key: item.key,
							prop,
							reason: `z-index:${specified} has no effect${where} (position:static)`,
						})
					} else if (
						[
							'width',
							'height',
							'min-width',
							'min-height',
							'max-width',
							'max-height',
						].includes(prop) &&
						!['auto', 'none'].includes(specified) &&
						box.display === 'inline' &&
						(item.pseudo != null || !REPLACED.has(tag))
					) {
						useless.push({
							key: item.key,
							prop,
							reason: `${prop}:${specified} has no effect${where} (non-replaced display:inline${item.pseudo != null ? ` ${item.pseudo}` : ` <${tag.toLowerCase()}>`})`,
						})
					}
				}
			}
			return { counts, useless, invalid: rejected }
		}, payload)
	} finally {
		await page.close()
	}
}

async function main() {
	const opts = parseArgs(process.argv.slice(2))
	if (opts.build) {
		execSync('bun run build:css', { cwd: root, stdio: 'inherit' })
	} else {
		warnIfStale()
	}

	const rules = collectRules()
	const allowlist = loadAllowlist(opts.allowlist)
	const norm = (s) => s.replace(/\s+/g, ' ').trim()
	const testable = []
	for (const [raw, entry] of rules) {
		if (!entry.test || allowlist.has(norm(raw))) continue
		testable.push({
			key: raw,
			test: entry.test,
			pseudo: entry.pseudo ?? null,
			decls: [...entry.decls].map(([prop, values]) => ({
				prop,
				values: [...values],
			})),
		})
	}

	let pages = [...ADMIN_PAGES, ...EXTRA_PAGES]
	if (opts.grep) pages = pages.filter((p) => p.name.includes(opts.grep))
	if (pages.length === 0) {
		console.error('no pages match --grep')
		process.exit(1)
	}

	const launchOpts = {}
	if (typeof process.getuid === 'function' && process.getuid() === 0) {
		launchOpts.args = ['--no-sandbox']
	}
	const browser = await chromium.launch(launchOpts)
	const hits = new Map()
	const uselessHits = new Map()
	const invalidKeys = new Set()
	try {
		for (const theme of ['light', 'dark']) {
			const context = await browser.newContext()
			await context.addInitScript((value) => {
				localStorage.setItem('attrium-theme', value)
			}, theme)
			const loginPage = await context.newPage()
			try {
				await login(loginPage, opts.baseUrl)
			} catch (error) {
				console.error(
					`cannot reach or log into ${opts.baseUrl} — is wp-env running? (${error.message})`,
				)
				process.exit(1)
			} finally {
				await loginPage.close()
			}
			for (const pageInfo of pages) {
				const name = `${theme}:${pageInfo.name}`
				let result
				try {
					result = await probePage(
						context,
						{ path: new URL(pageInfo.path, opts.baseUrl).toString() },
						testable,
					)
				} catch (error) {
					console.error(`skip ${name}: ${error.message}`)
					continue
				}
				for (const [key, count] of Object.entries(result.counts)) {
					if (count > 0) {
						if (!hits.get(key)) hits.set(key, [])
						hits.get(key).push(name)
					}
				}
				for (const key of result.invalid ?? []) invalidKeys.add(key)
				for (const flag of result.useless) {
					const id = `${flag.key}\0${flag.prop}`
					if (!uselessHits.get(id))
						uselessHits.set(id, { samples: 0, reasons: new Set(), pages: [] })
					const acc = uselessHits.get(id)
					acc.samples += 1
					acc.reasons.add(flag.reason)
					acc.pages.push(name)
				}
				if (!opts.json)
					process.stderr.write(
						`\rprobed ${name} (${testable.length} selectors)`,
					)
			}
			await context.close()
		}
		if (!opts.json) process.stderr.write('\n')
	} finally {
		await browser.close()
	}

	// A useless flag counts only when EVERY sampled element agrees — a
	// declaration that works somewhere sampled is not useless. Entries are
	// keyed by selector, then property (`\0` can't occur in a selector).
	const useless = []
	for (const [id, acc] of uselessHits) {
		const [key, prop] = id.split('\0')
		const matchedPages = new Set(hits.get(key) ?? [])
		const sampledPages = new Set(acc.pages)
		const usefulSomewhere = [...matchedPages].some((p) => !sampledPages.has(p))
		if (!usefulSomewhere && acc.samples > 0) {
			const entry = rules.get(key)
			useless.push({
				selector: key,
				prop,
				reasons: [...acc.reasons],
				files: [...(entry?.files ?? [])],
				samples: acc.samples,
			})
		}
	}

	const dead = []
	const skipped = []
	for (const [raw, entry] of rules) {
		if (allowlist.has(norm(raw))) continue
		if (!entry.test || invalidKeys.has(raw)) {
			skipped.push({ selector: raw, files: [...entry.files] })
			continue
		}
		if (!hits.has(raw)) {
			dead.push({
				selector: raw,
				files: [...entry.files],
				media: [...entry.media],
				dynamic: entry.dynamic,
			})
		}
	}
	dead.sort((a, b) => a.selector.localeCompare(b.selector))
	useless.sort((a, b) => a.selector.localeCompare(b.selector))

	const report = {
		pages: pages.map((p) => p.name),
		selectors: rules.size,
		dead,
		useless,
		skipped,
		allowlisted: allowlist.size,
	}

	if (opts.json) {
		console.log(JSON.stringify(report, null, 2))
	} else {
		console.log(
			`\nchecked ${report.selectors} selectors on ${pages.length} pages x light+dark`,
		)
		console.log(
			`\n== DEAD SELECTORS (${dead.length}) — matched nothing anywhere ==`,
		)
		for (const d of dead) {
			console.log(`  ${d.selector}`)
			console.log(
				`    ${d.files.join(', ')}${d.media.length ? `  [${d.media.join(' | ')}]` : ''}${d.dynamic ? '  (dynamic)' : ''}`,
			)
		}
		if (dead.length === 0) console.log('  none')
		console.log(
			`\n== USELESS DECLARATIONS (${useless.length}) — ignored on every sample ==`,
		)
		for (const u of useless) {
			console.log(`  ${u.selector} :: ${u.prop}`)
			console.log(
				`    ${u.reasons.join(' ; ')}  [${u.files.join(', ')}]  (${u.samples} samples)`,
			)
		}
		if (useless.length === 0) console.log('  none')
		console.log(
			`\n== SKIPPED (${skipped.length}) — not evaluable (empty after stripping or unparseable) ==`,
		)
		for (const s of skipped.slice(0, 20)) {
			console.log(`  ${s.selector}  [${s.files.join(', ')}]`)
		}
		if (skipped.length > 20)
			console.log(`  ... and ${skipped.length - 20} more (see --json)`)
		if (skipped.length === 0) console.log('  none')
		console.log(`\nallowlisted: ${report.allowlisted}`)
		console.log(
			'\nNote: interactive states (hover/open/focus) are not exercised — triage DEAD against the allowlist before deleting.',
		)
	}

	if (opts.strict && (dead.length > 0 || useless.length > 0)) process.exit(1)
}

await main()
