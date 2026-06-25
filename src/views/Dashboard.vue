<script setup lang="ts">
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useServerData } from '@/composables/useServerData'

// Placeholder native dashboard. Replaces the slotted WP dashboard when the
// server reports screenId === 'dashboard'. Fill with real widgets later.
const { userName, pluginVersion } = useServerData()
</script>

<template>
  <div class="flex flex-col gap-6 px-4 py-4 md:px-6 md:py-6">
    <div class="flex flex-col gap-1">
      <h1 class="text-2xl font-semibold tracking-tight">Welcome, {{ userName }}</h1>
      <p class="text-muted-foreground text-sm">
        Attrium dashboard placeholder — real widgets land here soon.
      </p>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <Card v-for="n in 3" :key="n">
        <CardHeader>
          <CardTitle class="text-base">Placeholder {{ n }}</CardTitle>
          <CardDescription>Widget slot reserved for later.</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="bg-muted h-24 w-full animate-pulse rounded-md" />
        </CardContent>
      </Card>
    </div>

    <p class="text-muted-foreground text-xs">Attrium v{{ pluginVersion }}</p>
  </div>
</template>
