<template>
  <section class="page podcast-series-view">
    <header class="podcast-series-header">
      <UBreadcrumb class="app-breadcrumb" :items="withHomeIcon(breadcrumbItems)" />
      <div v-if="series" class="podcast-series-hero">
        <div class="podcast-cover podcast-cover-large" aria-hidden="true">
          <img src="/assets/icon.png" alt="" />
          <span>Jura<br />Audio</span>
        </div>
        <div>
          <p class="eyebrow">{{ legalAreaName }} · {{ series.edition }}</p>
          <h1>{{ series.title }}</h1>
          <p>{{ series.description }}</p>
          <div class="podcast-series-summary">
            <span>{{ series.episodes.length }} Folgen</span>
            <span>{{ completedCount }} abgeschlossen</span>
            <span>{{ totalDuration }}</span>
          </div>
          <UButton v-if="nextEpisode" size="lg" @click="playEpisode(nextEpisode)">
            <Play :size="18" fill="currentColor" aria-hidden="true" />
            {{ nextEpisode.progress?.positionSeconds ? 'Fortsetzen' : 'Reihe starten' }}
          </UButton>
        </div>
      </div>
    </header>

    <div v-if="player.catalogLoading.value" class="podcast-episode-skeleton">
      <USkeleton v-for="index in 5" :key="index" />
    </div>
    <UAlert v-else-if="player.catalogError.value" color="error" :description="player.catalogError.value" />
    <section v-else-if="series" class="podcast-episode-list" aria-label="Podcast-Folgen">
      <article
        v-for="episode in series.episodes"
        :key="episode.id"
        class="podcast-episode"
        :class="{ 'is-active': player.currentEpisode.value?.id === episode.id }"
      >
        <UButton
          class="podcast-episode-play"
          :aria-label="`${episode.title} abspielen`"
          :title="`${episode.title} abspielen`"
          @click="playEpisode(episode)"
        >
          <Pause v-if="player.currentEpisode.value?.id === episode.id && player.playing.value" :size="18" />
          <Play v-else :size="18" fill="currentColor" />
        </UButton>
        <span class="podcast-episode-number">{{ String(episode.number).padStart(2, '0') }}</span>
        <div class="podcast-episode-copy">
          <h2>{{ episode.title }}</h2>
          <p>{{ episode.description }}</p>
          <div v-if="episode.progress" class="episode-progress">
            <span :style="{ width: `${episodeProgress(episode)}%` }" />
          </div>
        </div>
        <div class="podcast-episode-meta">
          <span v-if="episode.progress?.completed" class="episode-complete">
            <CircleCheck :size="15" />
            Gehört
          </span>
          <span v-else-if="episode.progress?.positionSeconds">Fortsetzen</span>
          <span>{{ formatDuration(episode.durationSeconds) }}</span>
        </div>
      </article>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { CircleCheck, Pause, Play } from 'lucide-vue-next'
import type { PodcastEpisode } from '@shared/schemas'
import { usePodcastPlayer } from '../podcasts/usePodcastPlayer'
import { type AppBreadcrumbItem, withHomeIcon } from '../ui/breadcrumbs'

const route = useRoute()
const player = usePodcastPlayer()
const series = computed(() =>
  player.catalog.value?.legalAreas
    .flatMap((area) => area.series)
    .find((candidate) => candidate.slug === route.params.seriesSlug)
)
const legalAreaName = computed(
  () =>
    player.catalog.value?.legalAreas.find((area) =>
      area.series.some((candidate) => candidate.id === series.value?.id)
    )?.name ?? 'Rechtsgebiet'
)
const completedCount = computed(
  () => series.value?.episodes.filter((episode) => episode.progress?.completed).length ?? 0
)
const nextEpisode = computed(
  () =>
    series.value?.episodes.find((episode) => !episode.progress?.completed) ??
    series.value?.episodes[0]
)
const totalDuration = computed(() =>
  formatDuration(series.value?.episodes.reduce((sum, episode) => sum + episode.durationSeconds, 0) ?? 0)
)
const breadcrumbItems = computed<AppBreadcrumbItem[]>(() => [
  { label: 'Home', to: { name: 'home' } },
  { label: 'Podcasts', to: { name: 'podcasts' } },
  { label: series.value?.title ?? 'Lernreihe' }
])

onMounted(() => {
  void player.loadCatalog()
})

function playEpisode(episode: PodcastEpisode): void {
  if (!series.value) return
  if (player.currentEpisode.value?.id === episode.id) {
    void player.togglePlayback()
    return
  }
  void player.playEpisode(episode, series.value.episodes)
}

function episodeProgress(episode: PodcastEpisode): number {
  if (episode.progress?.completed) return 100
  return episode.progress?.durationSeconds
    ? Math.min(100, (episode.progress.positionSeconds / episode.progress.durationSeconds) * 100)
    : 0
}

function formatDuration(seconds: number): string {
  const roundedMinutes = Math.round(seconds / 60)
  if (roundedMinutes < 60) return `${roundedMinutes} Min.`
  const hours = Math.floor(roundedMinutes / 60)
  const minutes = roundedMinutes % 60
  return `${hours} Std. ${minutes} Min.`
}
</script>
