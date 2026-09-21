<template>
  <div :class="['study-celebration-region', { 'study-celebration-complete': complete }]" aria-live="polite" aria-atomic="true">
    <Transition name="study-celebration">
      <aside v-if="celebration" class="study-celebration" :aria-label="complete ? 'Durchgang geschafft' : 'Lernerfolg'">
        <img :src="celebration.imageUrl" alt="" width="88" height="88" />
        <div>
          <span>{{ celebration.count }} {{ celebration.count === 1 ? 'Karte' : 'Karten' }} bearbeitet</span>
          <strong>{{ celebration.title }}</strong>
          <p>{{ celebration.copy }}</p>
        </div>
        <UButton v-if="!complete" color="neutral" variant="ghost" icon="i-lucide-x" aria-label="Motivation ausblenden" @click="$emit('dismiss')" />
      </aside>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import type { StudyCelebration } from '../ui/studyCelebration'

const props = defineProps<{ celebration: StudyCelebration | null; complete?: boolean }>()
const emit = defineEmits<{ dismiss: [] }>()
let timer: ReturnType<typeof setTimeout> | undefined
watch(() => props.celebration, (value) => {
  clearTimeout(timer)
  if (value && !props.complete) timer = setTimeout(() => emit('dismiss'), 4000)
}, { immediate: true })
onUnmounted(() => clearTimeout(timer))
</script>

<style scoped>
.study-celebration-region { width: 100%; }
.study-celebration { display: flex; align-items: center; gap: 14px; padding: 12px; margin-top: 16px; border: 1px solid var(--color-border); border-radius: 16px; background: var(--color-surface); text-align: left; }
.study-celebration img { flex: 0 0 88px; width: 88px; height: 88px; object-fit: cover; border-radius: 12px; background: white; }
.study-celebration > div { flex: 1; min-width: 0; }
.study-celebration span { display: block; font-size: 12px; color: var(--color-text-muted); }
.study-celebration strong { display: block; font-size: 20px; color: var(--color-text); }
.study-celebration p { margin: 3px 0 0; font-size: 14px; color: var(--color-text-muted); }
.study-celebration-complete { max-width: 480px; margin: 0 auto 24px; }
.study-celebration-complete .study-celebration { margin-top: 0; }
.study-celebration-enter-active { transition: opacity 180ms, transform 180ms; }
.study-celebration-leave-active { transition: opacity 120ms; }
.study-celebration-enter-from { opacity: 0; transform: translateY(6px); }
.study-celebration-leave-to { opacity: 0; }
@media (max-width: 600px) {
  .study-celebration { gap: 10px; padding: 10px; }
  .study-celebration img { flex-basis: 64px; width: 64px; height: 64px; }
  .study-celebration strong { font-size: 18px; }
}
@media (prefers-reduced-motion: reduce) {
  .study-celebration-enter-active, .study-celebration-leave-active { transition: none; }
  .study-celebration-enter-from { transform: none; }
}
</style>
