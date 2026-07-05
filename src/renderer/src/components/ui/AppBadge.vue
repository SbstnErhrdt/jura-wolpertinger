<template>
  <span class="app-badge" :class="`app-badge-${tone}`">
    <slot />
  </span>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'neutral' | 'blue' | 'success' | 'warning' | 'danger'
  }>(),
  {
    tone: 'blue'
  }
)
</script>
