/**
 * Attrium's pre-paint light/dark resolver.
 *
 * Read and printed synchronously into <head> by Attrium\Utility\Theme —
 * never enqueued, never bundled, never deferred: it must set `attrium-dark`
 * on <html> before first paint (a deferred module would flash light), and
 * customize.php loads no Attrium bundle at all. This file owns the decision
 * rule and every runtime input that can change it; Theme.php owns where and
 * when it prints. The 'attrium-theme' / 'attrium-dark' literals are
 * duplicated in src/composables/useTheme.ts; theme-resolution.spec.ts pins
 * the contract behaviorally, so a drift fails CI instead of shipping.
 */
;(() => {
	const query = window.matchMedia('(prefers-color-scheme: dark)')

	function apply() {
		let stored
		try {
			stored = localStorage.getItem('attrium-theme')
		} catch {}
		const auto = !stored || stored === 'auto'
		const dark = stored === 'dark' || (auto && query.matches)
		document.documentElement.classList.toggle('attrium-dark', dark)
	}

	apply()

	window.addEventListener('storage', (event) => {
		if (event.key === 'attrium-theme') {
			apply()
		}
	})

	query.addEventListener('change', apply)
})()
