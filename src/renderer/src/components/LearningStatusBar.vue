<template>
  <div class="learning-status-bar" role="img" :aria-label="accessibleLabel">
    <span
      v-for="segment in segments"
      :key="segment.key"
      :class="{
        'learning-status-segment-not-known': segment.key === 'not-known',
        'learning-status-segment-partially-known': segment.key === 'partially-known',
        'learning-status-segment-known': segment.key === 'known',
        'learning-status-segment-unreviewed': segment.key === 'unreviewed'
      }"
      :style="{ width: `${segment.percentage}%` }"
      aria-hidden="true"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LearningStatusCounts } from '@shared/learningStatus'
import { learningStatusSegments } from '@shared/learningStatus'

const props = defineProps<{
  total: number
  counts: LearningStatusCounts
  label: string
}>()

const segments = computed(() => learningStatusSegments(props.total, props.counts))
const accessibleLabel = computed(() =>
  `${props.label}: ${segments.value.map((segment) => `${segment.count} ${segment.label}`).join(', ')}`
)
</script>
