/// <reference types="vite/client" />

declare global {
	interface Window {
		/** Portal container inside the shadow root (set in main.ts). */
		__ATTRIUM_PORTAL__?: HTMLElement
	}
}

export {}
