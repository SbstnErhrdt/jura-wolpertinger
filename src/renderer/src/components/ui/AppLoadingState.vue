<template>
  <div class="app-loading-state" role="status" aria-live="polite" aria-busy="true">
    <span class="visually-hidden">{{ label }}</span>
    <div class="app-loading-state-content" aria-hidden="true">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ label: string }>()
</script>
