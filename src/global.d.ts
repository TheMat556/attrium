/// <reference types="vite/client" />

declare global {
	interface Window {
		/** Portal container inside the shadow root (set in main.ts). */
		__ATTRIUM_PORTAL__?: HTMLElement
		/** Bootstrap watchdog timer ID (set in Attrium.php inline <script>). */
		__ATTRIUM_WATCHDOG__?: ReturnType<typeof setTimeout>
	}
}

export {}
