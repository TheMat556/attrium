// Verify scss/_icons.scss's $icons map against the installed @lucide/vue.
//
// The map is hand-pasted from lucide.dev while the Vue shell renders the same
// glyphs from @lucide/vue — two sources for one icon set. This check pins the
// paste to the installed package: every map entry must match the package's
// iconNode data (node sequence + attributes; the `key` attr is excluded — it
// is per-node render bookkeeping, not geometry). A mismatch means the paste
// drifted from the dependency the shell renders with — re-paste the inner
// markup from lucide.dev (or accept the new geometry deliberately after a
// @lucide/vue upgrade).
//
// Runs as stage 0 of scripts/build-css.mjs: drift fails the build before any
// chunk is written, so the light-DOM glyphs and the shell's icons can't
// silently diverge.

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dir, '..')

// ---- scss side ---------------------------------------------------------------

// name → inner SVG markup, extracted from the $icons map literal.
function readScssIcons() {
	const source = readFileSync(path.join(root, 'scss/_icons.scss'), 'utf8')
	const map = source.match(/\$icons:\s*\(([\s\S]*?)\n\);/)

	if (!map) {
		throw new Error(
			'check-icons: could not locate the $icons map in scss/_icons.scss',
		)
	}

	const icons = {}
	const entry = /'([^']+)':\s*"((?:[^"\\]|\\.)*)"/g

	for (const [, name, markup] of map[1].matchAll(entry)) {
		icons[name] = markup
	}

	return icons
}

// Inner markup → [{ tag, attrs }]. Lucide inner nodes are always self-closing
// elements with single-quoted attributes (the paste format).
function parseMarkup(markup) {
	const nodes = []
	const element = /<(\w+)\s+([^>]*?)\/>/g

	for (const [, tag, attrList] of markup.matchAll(element)) {
		const attrs = {}
		const attr = /([\w-]+)='([^']*)'/g

		for (const [, key, value] of attrList.matchAll(attr)) {
			attrs[key] = value
		}

		nodes.push({ tag, attrs })
	}

	return nodes
}

// ---- lucide side -------------------------------------------------------------

// name → [{ tag, attrs }] from the per-icon iconNode literal in @lucide/vue's
// dist, or null when the package has no icon by that name. Attribute values
// are double-quoted strings; `key` is dropped.
function readLucideIcon(name) {
	const file = path.join(
		root,
		'node_modules/@lucide/vue/dist/esm/icons',
		`${name}.mjs`,
	)

	if (!existsSync(file)) {
		return null
	}

	const source = readFileSync(file, 'utf8')
	const node = source.match(/const __iconNode = \[([\s\S]*?)\];/)

	if (!node) {
		throw new Error(`check-icons: ${name}.mjs has no __iconNode literal`)
	}

	const nodes = []
	const element = /\[\s*"(\w+)"\s*,\s*\{([\s\S]*?)\}\s*\]/g

	for (const [, tag, attrList] of node[1].matchAll(element)) {
		const attrs = {}
		const attr = /([\w-]+)\s*:\s*"((?:[^"\\]|\\.)*)"/g

		for (const [, key, value] of attrList.matchAll(attr)) {
			if (key !== 'key') {
				attrs[key] = value
			}
		}

		nodes.push({ tag, attrs })
	}

	return nodes
}

// ---- comparison ----------------------------------------------------------------

// Render nodes back to paste format so an error message is a re-paste source.
function serialize(nodes) {
	return nodes
		.map(({ tag, attrs }) => {
			const attrList = Object.entries(attrs)
				.map(([key, value]) => `${key}='${value}'`)
				.join(' ')

			return `<${tag} ${attrList}/>`
		})
		.join('')
}

// First difference between two node lists, or null when they agree. Attribute
// order is ignored on both sides — only tag sequence and attr values carry
// geometry.
function firstDiff(expected, actual) {
	if (expected.length !== actual.length) {
		return `node count: lucide has ${expected.length}, map has ${actual.length}`
	}

	for (const [index, exp] of expected.entries()) {
		const act = actual[index]

		if (exp.tag !== act.tag) {
			return `node ${index}: lucide <${exp.tag}>, map <${act.tag}>`
		}

		const keys = new Set([...Object.keys(exp.attrs), ...Object.keys(act.attrs)])

		for (const key of keys) {
			if (exp.attrs[key] !== act.attrs[key]) {
				return (
					`node ${index} <${exp.tag}>, attr '${key}': ` +
					`lucide '${exp.attrs[key]}', map '${act.attrs[key]}'`
				)
			}
		}
	}

	return null
}

// One error string per drifted icon; an empty array means the map is in sync.
export function verifyIcons() {
	const errors = []

	for (const [name, markup] of Object.entries(readScssIcons())) {
		const lucide = readLucideIcon(name)

		if (lucide === null) {
			errors.push(
				`check-icons: '${name}' has no file in @lucide/vue ` +
					`(dist/esm/icons/${name}.mjs) — check the icon name`,
			)
			continue
		}

		const drift = firstDiff(lucide, parseMarkup(markup))

		if (drift) {
			errors.push(
				`check-icons: '${name}' drifted from @lucide/vue (${drift}). ` +
					`lucide markup: ${serialize(lucide)}`,
			)
		}
	}

	return errors
}
