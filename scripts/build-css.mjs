// Compile each scss/entries/*.scss topic into its own minified chunk in
// app/dist (admin-theme-{topic}.css). Sass resolves the @use/@include graph;
// the Tailwind CLI stage expands the @apply utilities — each entry carries its
// own `@reference "tailwindcss"`, which emits no CSS itself. The PHP side
// enqueues chunks per enabled module (see ModuleRegistry::enqueue_styles()).

import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { $ } from 'bun'

// Ensure the output directory exists (a standalone `bun run build:css` on a
// fresh clone has no app/dist yet). The entries build into per-topic chunks.
mkdirSync('app/dist', { recursive: true })

// Remove any previous build output so a renamed/removed topic can't leave a
// stale chunk behind. Done in JS (not a shell glob) so a dist with no matches
// doesn't error.
for (const file of readdirSync('app/dist')) {
	if (/^admin-theme(?:-.*)?\.css$/.test(file)) {
		rmSync(`app/dist/${file}`)
	}
}

const entries = readdirSync('scss/entries')
	.filter((file) => file.endsWith('.scss'))
	.sort()

// Compile one entry: sass → tailwind → remove the intermediate. The topic
// chunks are independent, so build them in parallel.
async function buildEntry(entry) {
	const name = entry.replace(/\.scss$/, '')
	const tmp = `app/dist/admin-theme-${name}.tmp.css`
	await $`sass scss/entries/${entry} ${tmp} --no-source-map`
	await $`tailwindcss -i ${tmp} -o app/dist/admin-theme-${name}.css --minify`
	rmSync(tmp)
}

await Promise.all(entries.map(buildEntry))
