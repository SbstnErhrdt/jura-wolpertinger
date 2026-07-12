<template>
  <nav class="app-breadcrumb" aria-label="Pfad">
    <ol>
      <li v-for="(item, index) in items" :key="`${item.label}-${index}`" class="app-breadcrumb-item">
        <RouterLink v-if="item.to" :to="item.to" class="app-breadcrumb-link">
          <Home v-if="index === 0" :size="14" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </RouterLink>
        <span v-else class="app-breadcrumb-current" :aria-current="index === items.length - 1 ? 'page' : undefined">
          <Home v-if="index === 0" :size="14" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </span>
        <ChevronRight v-if="index < items.length - 1" class="app-breadcrumb-separator" :size="14" aria-hidden="true" />
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { RouterLink } from 'vue-router'
import { ChevronRight, Home } from 'lucide-vue-next'

export type BreadcrumbItem = {
  label: string
  to?: RouteLocationRaw
}

defineProps<{
  items: BreadcrumbItem[]
}>()
</script>
