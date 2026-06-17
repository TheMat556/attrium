import { useColorMode } from '@vueuse/core'
import { computed } from 'vue'

export const mode = useColorMode({
	selector: '#attrium-host',
	attribute: 'class',
	modes: { light: '', dark: 'dark' },
	storageKey: 'attrium-theme',
	onChanged() {
		applyThemeToHost()
	},
})

export const isDark = computed(() => mode.value === 'dark')
export const toggle = () => {
	mode.value = mode.value === 'dark' ? 'light' : 'dark'
}

// Call this after #attrium-host exists to sync the initial state
export function applyThemeToHost() {
	const host = document.getElementById('attrium-host')
	if (!host) return
	host.classList.toggle('dark', mode.value === 'dark')
}
