// Re-run the topic build whenever any .scss under scss/ changes.
import { watch } from 'node:fs'
import { $ } from 'bun'

let timer
watch('scss', { recursive: true }, (_event, filename) => {
	clearTimeout(timer)
	timer = setTimeout(async () => {
		// A sass/syntax error while editing must not kill the watcher — log it
		// and keep watching so the next save retries instead of forcing a
		// manual restart.
		try {
			console.log(`[watch:css] ${filename} changed — rebuilding chunks`)
			await $`bun run scripts/build-css.mjs`
		} catch (error) {
			console.error(`[watch:css] build failed after ${filename} changed:`)
			console.error(error)
		}
	}, 150)
})
console.log('[watch:css] watching scss/ (Ctrl+C to stop)')
