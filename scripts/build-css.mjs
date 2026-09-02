// Compile each scss/entries/*.scss topic into its own minified chunk in
// app/dist (admin-theme-{topic}.css), which ModuleRegistry::enqueue_styles()
// then enqueues per enabled module.
//
// Two stages per topic: Sass resolves the @use/@include graph, then the
// Tailwind CLI expands the @apply utilities (each entry carries its own
// `@reference "tailwindcss"`, which emits no CSS itself). Sass runs through its
// JS API rather than the CLI so the intermediate CSS stays in memory — the
// former version wrote an `admin-theme-{topic}.tmp.css` beside each chunk and
// leaked it whenever a build failed.
//
// Every topic is compiled before ANY chunk is written. A partially-built dist is
// worse than a stale one: ModuleRegistry skips chunks that don't exist
// (`file_exists`), so a half-built dist silently serves an unstyled module with
// no error anywhere, while a stale dist at least still renders. This only
// guards compile failures — the write loop itself is not transactional.

import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { $ } from 'bun'
import { compile } from 'sass'

// Resolve everything from the project root, not process.cwd(), so the script
// works when invoked by path (`bun run scripts/build-css.mjs`) from anywhere —
// `bun run build:css` normalizes the cwd, a direct call does not. That includes
// the Tailwind binary: Bun puts node_modules/.bin on PATH relative to the cwd,
// so a bare `tailwindcss` would not resolve from a subdirectory.
const root = path.resolve(import.meta.dir, '..')
const entriesDir = path.join(root, 'scss/entries')
const outDir = path.join(root, 'app/dist')
const tailwind = path.join(root, 'node_modules/.bin/tailwindcss')

const entries = readdirSync(entriesDir)
	.filter((file) => file.endsWith('.scss'))
	.sort()

// --- Stage 1: Sass (in memory) ----------------------------------------------
// Compiled in a plain loop because sass's compile() is synchronous, and errors
// are collected rather than thrown so ONE broken shared partial reports every
// entry it breaks instead of just whichever rejected first.
const compiled = []
const errors = []

for (const entry of entries) {
	try {
		const { css } = compile(path.join(entriesDir, entry), { sourceMap: false })
		compiled.push({ name: entry.replace(/\.scss$/, ''), css })
	} catch (error) {
		errors.push(`${entry}\n${error.message}`)
	}
}

// --- Stage 2: Tailwind (in memory) ------------------------------------------
// The default `-o -` writes to stdout, so the expanded CSS is captured instead
// of landing in app/dist; `--silent` drops the per-invocation banner but still
// reports real errors (e.g. an unknown utility in @apply) and exits non-zero.
// Independent per topic, so these run in parallel.
//
// The trailing newline is stripped because Tailwind adds one when writing to
// stdout but not when writing to a file — without this the chunks would differ
// from the CLI's own output by a byte, and "the compiled CSS is unchanged" is
// the check that proves an SCSS refactor was behaviour-preserving.
const built = await Promise.allSettled(
	compiled.map(async ({ name, css }) => {
		const out =
			await $`${tailwind} -i - --minify --silent < ${Buffer.from(css)}`.text()
		return { name, css: out.replace(/\n$/, '') }
	}),
)

for (const [index, result] of built.entries()) {
	if (result.status === 'rejected') {
		errors.push(
			`${compiled[index].name}\n${result.reason.stderr ?? result.reason}`,
		)
	}
}

if (errors.length > 0) {
	console.error(
		`build-css: ${errors.length} of ${entries.length} topics failed to ` +
			'compile; app/dist left unchanged.\n',
	)
	for (const error of errors) {
		console.error(error)
	}
	process.exit(1)
}

// --- Commit: replace the chunks ---------------------------------------------
// Only reached when every topic compiled. Stale chunks are removed first so a
// renamed or deleted topic can't leave an orphan behind that PHP would keep
// enqueueing. mkdirSync covers a fresh clone with no app/dist yet.
mkdirSync(outDir, { recursive: true })

for (const file of readdirSync(outDir)) {
	if (/^admin-theme(?:-.*)?\.css$/.test(file)) {
		rmSync(path.join(outDir, file))
	}
}

await Promise.all(
	built.map(({ value: { name, css } }) =>
		Bun.write(path.join(outDir, `admin-theme-${name}.css`), css),
	),
)

console.log(`build-css: wrote ${built.length} chunks to app/dist`)
