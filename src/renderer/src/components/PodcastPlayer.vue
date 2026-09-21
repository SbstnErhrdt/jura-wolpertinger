<template>
  <Transition name="podcast-player">
    <section
      v-if="player.currentEpisode.value"
      class="podcast-player"
      :class="{ 'is-expanded': player.expanded.value }"
      aria-label="Podcast-Player"
    >
      <div class="podcast-player-main">
        <UButton
          class="podcast-player-cover"
          color="neutral"
          variant="ghost"
          title="Player öffnen"
          @click="player.toggleExpanded"
        >
          <img src="/assets/icon.png" alt="" />
        </UButton>
        <UButton
          class="podcast-player-copy"
          color="neutral"
          variant="ghost"
          @click="player.toggleExpanded"
        >
          <span>Jetzt hören</span>
          <strong>{{ player.currentEpisode.value.title }}</strong>
          <small>
            {{ formatTime(player.currentTime.value) }} /
            {{ formatTime(player.duration.value || player.currentEpisode.value.durationSeconds) }}
          </small>
        </UButton>

        <div class="podcast-player-transport">
          <UButton
            class="podcast-icon-control podcast-secondary-control"
            color="neutral"
            variant="ghost"
            :disabled="!player.canGoPrevious.value"
            title="Vorherige Folge"
            aria-label="Vorherige Folge"
            @click="player.previousEpisode"
          >
            <SkipBack :size="18" />
          </UButton>
          <UButton
            class="podcast-icon-control podcast-secondary-control podcast-wide-control"
            color="neutral"
            variant="ghost"
            title="15 Sekunden zurück"
            aria-label="15 Sekunden zurück"
            @click="player.seekBy(-15)"
          >
            <RotateCcw :size="18" />
            <span>15</span>
          </UButton>
          <UButton
            class="podcast-icon-control podcast-primary-control"
            :title="player.playing.value ? 'Pause' : 'Abspielen'"
            :aria-label="player.playing.value ? 'Pause' : 'Abspielen'"
            @click="player.togglePlayback"
          >
            <Pause v-if="player.playing.value" :size="22" fill="currentColor" />
            <Play v-else :size="22" fill="currentColor" />
          </UButton>
          <UButton
            class="podcast-icon-control podcast-secondary-control podcast-wide-control"
            color="neutral"
            variant="ghost"
            title="30 Sekunden vor"
            aria-label="30 Sekunden vor"
            @click="player.seekBy(30)"
          >
            <RotateCw :size="18" />
            <span>30</span>
          </UButton>
          <UButton
            class="podcast-icon-control podcast-secondary-control"
            color="neutral"
            variant="ghost"
            :disabled="!player.canGoNext.value"
            title="Nächste Folge"
            aria-label="Nächste Folge"
            @click="player.nextEpisode"
          >
            <SkipForward :size="18" />
          </UButton>
        </div>

        <UButton
          class="podcast-icon-control podcast-expand-control"
          color="neutral"
          variant="ghost"
          :title="player.expanded.value ? 'Player schließen' : 'Player öffnen'"
          :aria-label="player.expanded.value ? 'Player schließen' : 'Player öffnen'"
          @click="player.toggleExpanded"
        >
          <ChevronDown v-if="player.expanded.value" :size="20" />
          <ChevronUp v-else :size="20" />
        </UButton>
      </div>

      <div class="podcast-player-progress">
        <USlider
          v-model="seekValue"
          :min="0"
          :max="player.duration.value || player.currentEpisode.value.durationSeconds"
          :step="1"
          aria-label="Wiedergabeposition"
        />
      </div>

      <div v-if="player.expanded.value" class="podcast-player-expanded">
        <div class="podcast-expanded-artwork">
          <img src="/assets/icon.png" alt="" />
          <span>Jura Audio</span>
        </div>
        <div>
          <p>Jura Wolpertinger Podcast</p>
          <h2>{{ player.currentEpisode.value.title }}</h2>
          <RouterLink
            v-if="player.currentSeriesSlug.value"
            :to="{
              name: 'podcast-series',
              params: { seriesSlug: player.currentSeriesSlug.value }
            }"
          >
            Alle Folgen ansehen
          </RouterLink>
        </div>
        <UFormField label="Tempo">
          <USelect
            :model-value="player.playbackRate.value"
            :items="playbackRates"
            value-key="value"
            @update:model-value="setPlaybackRate"
          />
        </UFormField>
      </div>
    </section>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward
} from 'lucide-vue-next'
import { usePodcastPlayer } from '../podcasts/usePodcastPlayer'

const player = usePodcastPlayer()
const playbackRates = [0.75, 1, 1.25, 1.5, 1.75, 2].map((value) => ({
  label: `${value.toLocaleString('de-DE')}×`,
  value
}))
const seekValue = computed({
  get: () => player.currentTime.value,
  set: (value: number) => player.seekTo(value)
})

function setPlaybackRate(value: number | undefined): void {
  if (value) player.setPlaybackRate(value)
}

function formatTime(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const remainder = safeSeconds % 60
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`
}
</script>
