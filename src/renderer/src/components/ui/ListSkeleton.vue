<template>
  <div class="skeleton-list" :class="`skeleton-list-${variant}`" aria-hidden="true">
    <article v-for="index in count" :key="index" class="skeleton-tile">
      <template v-if="variant === 'flashcard'">
        <div class="skeleton-main">
          <span class="skeleton-line skeleton-line-title" />
          <span class="skeleton-line skeleton-line-wide" />
          <span class="skeleton-line skeleton-line-medium" />
        </div>
        <div class="skeleton-metrics">
          <span v-for="metric in 4" :key="metric" class="skeleton-box" />
        </div>
        <span class="skeleton-icon" />
      </template>
      <template v-else>
        <span class="skeleton-icon" />
        <div class="skeleton-main">
          <span class="skeleton-line skeleton-line-title" />
          <span class="skeleton-line skeleton-line-wide" />
          <span class="skeleton-line skeleton-line-medium" />
        </div>
        <span class="skeleton-pill" />
        <span class="skeleton-score" />
      </template>
    </article>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'exam' | 'flashcard'
    count?: number
  }>(),
  {
    variant: 'exam',
    count: 5
  }
)
</script>
