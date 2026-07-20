<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { ref } from 'vue'
import { useServerData } from '@/composables/useServerData'

const { isIgnored } = useServerData()
const appearanceUrl = 'admin.php?page=attrium'

// Pointer users reveal the panel on hover via CSS (group-hover). Keyboard and
// touch users get no hover, so the button also toggles `panelOpen`, which forces
// the panel visible via the `is-open` class. Escape / outside-click close it.
const root = ref<HTMLElement | null>(null)
const panelOpen = ref(false)

onClickOutside(root, () => {
	panelOpen.value = false
})

function onKeydownEsc(e: KeyboardEvent) {
	if (e.key === 'Escape') {
		panelOpen.value = false
	}
}
</script>

<template>
	<div
		ref="root"
		class="fixed bottom-6 right-6 z-50 group"
		:class="{ 'is-open': panelOpen }"
		role="none"
		@keydown="onKeydownEsc"
	>
		<div
			class="absolute bottom-12 right-0 mb-2 w-80 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-[.is-open]:opacity-100 group-[.is-open]:visible transition-all duration-200 ease-in-out translate-y-1 group-hover:translate-y-0 group-[.is-open]:translate-y-0"
		>
			<div
				class="rounded-lg border bg-popover text-popover-foreground p-4 text-sm leading-relaxed shadow-lg"
			>
				<template v-if="isIgnored">
					<p>
						This page has been excluded from Attrium styling, since it's from a
						third-party plugin whose elements Attrium can't fully style. We
						recommend keeping it excluded to avoid display issues.
					</p>
					<p class="mt-2">
						You can re-enable Attrium styling under
						<a :href="appearanceUrl" class="font-medium underline">
							Attrium &rarr; Appearance
						</a>
						.
					</p>
				</template>
				<template v-else>
					<p>
						This page is from a third-party plugin. Attrium can't style every
						element, so it might look different from the rest of your site.
					</p>
					<p class="mt-2">
						You can exclude it from Attrium styling under
						<a :href="appearanceUrl" class="font-medium underline">
							Attrium &rarr; Appearance
						</a>
						.
					</p>
				</template>
			</div>
		</div>
		<button
			type="button"
			class="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg transition-colors hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-500"
			aria-label="Page info"
			:aria-expanded="panelOpen"
			@click="panelOpen = !panelOpen"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<title>Info</title>
				<circle cx="12" cy="12" r="10" />
				<path d="M12 16v-4" />
				<path d="M12 8h.01" />
			</svg>
		</button>
	</div>
</template>
