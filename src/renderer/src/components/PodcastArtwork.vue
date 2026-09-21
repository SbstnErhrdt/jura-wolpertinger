<template>
  <div
    class="podcast-cover"
    :class="{
      'podcast-cover-large': large,
      'podcast-cover-has-artwork': artworkUrl && !showFallback
    }"
    aria-hidden="true"
  >
    <img
      v-if="artworkUrl && !showFallback"
      class="podcast-artwork-image"
      :src="artworkUrl"
      alt=""
      loading="lazy"
      decoding="async"
      @error="showFallback = true"
    />
    <template v-else>
      <img src="/assets/icon.png" alt="" />
      <span>Jura<br />Audio</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    artworkUrl: string | null
    title: string
    large?: boolean
  }>(),
  { large: false }
)

const showFallback = ref(false)

watch(
  () => props.artworkUrl,
  () => {
    showFallback.value = false
  }
)
</script>
