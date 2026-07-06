<template>
  <nav class="app-pagination" :aria-label="label">
    <p class="app-pagination-range">
      <span v-if="total > 0">{{ rangeStart }}-{{ rangeEnd }} von {{ total }}</span>
      <span v-else>0 von 0</span>
    </p>
    <div class="app-pagination-controls">
      <button
        type="button"
        class="secondary app-pagination-button"
        :disabled="disabled || page <= 1"
        aria-label="Vorherige Seite"
        @click="emit('update:page', page - 1)"
      >
        <ChevronLeft :size="17" aria-hidden="true" />
      </button>
      <span class="app-pagination-page">Seite {{ page }} von {{ pageCount }}</span>
      <button
        type="button"
        class="secondary app-pagination-button"
        :disabled="disabled || page >= pageCount"
        aria-label="Nächste Seite"
        @click="emit('update:page', page + 1)"
      >
        <ChevronRight :size="17" aria-hidden="true" />
      </button>
      <label class="app-pagination-size">
        <span>Pro Seite</span>
        <select
          class="page-size"
          :value="pageSize"
          :disabled="disabled"
          @change="emit('update:pageSize', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="option in pageSizeOptions" :key="option" :value="option">{{ option }}</option>
        </select>
      </label>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    page: number
    pageSize: number
    total: number
    pageCount?: number
    label?: string
    disabled?: boolean
  }>(),
  {
    label: 'Seitennavigation',
    disabled: false,
    pageCount: undefined
  }
)

const emit = defineEmits<{
  'update:page': [page: number]
  'update:pageSize': [pageSize: number]
}>()

const pageSizeOptions = [10, 25, 50, 100]
const pageCount = computed(() => props.pageCount ?? Math.max(1, Math.ceil(props.total / props.pageSize)))
const rangeStart = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1))
const rangeEnd = computed(() => Math.min(props.total, props.page * props.pageSize))
</script>
