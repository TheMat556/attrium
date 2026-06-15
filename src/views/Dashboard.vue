<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useServerData } from '@/composables/useServerData'

const { userName, siteUrl } = useServerData()
const wpVersion = ref('')

onMounted(async () => {
  try {
    const res = await fetch('/wp-json/')
    const data = await res.json()
    wpVersion.value = data?.offers?.[0]?.version || ''
  } catch {
    wpVersion.value = ''
  }
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Welcome, {{ userName }}</h1>
      <p class="text-muted-foreground">Here's your WordPress admin overview.</p>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <div class="rounded-lg border p-4">
        <h3 class="text-sm font-medium text-muted-foreground">Site</h3>
        <p class="mt-1 text-lg font-semibold">{{ siteUrl }}</p>
      </div>
      <div class="rounded-lg border p-4">
        <h3 class="text-sm font-medium text-muted-foreground">WordPress</h3>
        <p class="mt-1 text-lg font-semibold">{{ wpVersion || 'Loading...' }}</p>
      </div>
      <div class="rounded-lg border p-4">
        <h3 class="text-sm font-medium text-muted-foreground">Attrium</h3>
        <p class="mt-1 text-lg font-semibold">v1.0.0</p>
      </div>
    </div>
  </div>
</template>
