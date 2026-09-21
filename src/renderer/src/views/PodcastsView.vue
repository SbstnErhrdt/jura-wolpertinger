<template>
  <section class="page podcasts-view">
    <header class="page-header">
      <div>
        <AppBreadcrumb :items="breadcrumbItems" />
        <p class="eyebrow">Audio lernen</p>
        <h1>Podcasts</h1>
        <p>Juristische Lernreihen für unterwegs und zwischendurch.</p>
      </div>
    </header>

    <div class="podcast-search">
      <UFormField label="Podcasts durchsuchen" class="podcast-search-field">
        <UInput
          v-model="search"
          type="search"
          icon="i-lucide-search"
          placeholder="Rechtsgebiet, Reihe oder Folge"
          aria-label="Podcasts durchsuchen"
          :disabled="loading"
        />
      </UFormField>
      <UButton v-if="search" type="button" color="neutral" variant="outline" @click="resetPodcastSearch">
        Suche zurücksetzen
      </UButton>
      <p class="podcast-result-count" role="status" aria-live="polite">
        {{ loading ? 'Podcasts werden geladen …' : error ? '' : `${podcastResultCount} ${podcastResultCount === 1 ? 'Reihe' : 'Reihen'}${search.trim() ? ' gefunden' : ''}` }}
      </p>
    </div>

    <AppLoadingState v-if="loading" label="Podcasts werden geladen">
      <div class="podcast-library-skeleton">
        <USkeleton class="podcast-skeleton-title" />
        <USkeleton v-for="index in 3" :key="index" class="podcast-skeleton-card" />
      </div>
    </AppLoadingState>
    <UAlert v-else-if="error" color="error" :description="error">
      <template #actions><UButton type="button" color="neutral" variant="outline" @click="loadCatalog">Erneut versuchen</UButton></template>
    </UAlert>
    <div v-else-if="filteredCatalog.legalAreas.length" class="podcast-legal-areas">
      <section v-for="legalArea in filteredCatalog.legalAreas" :key="legalArea.slug">
        <div class="podcast-section-heading">
          <Landmark :size="19" aria-hidden="true" />
          <h2>{{ legalArea.name }}</h2>
        </div>
        <div class="podcast-series-grid">
          <UPageCard
            v-for="series in legalArea.series"
            :key="series.id"
            class="podcast-series-card"
            :to="{ name: 'podcast-series', params: { seriesSlug: series.slug } }"
            :aria-label="series.title"
          >
            <PodcastArtwork :artwork-url="series.artworkUrl" :title="series.title" />
            <div class="podcast-series-copy">
              <p>{{ series.edition }}</p>
              <h3>{{ series.title }}</h3>
              <span>{{ series.description }}</span>
              <div class="podcast-series-progress">
                <div class="podcast-series-progress-caption">
                  <span>{{ progressLabel(series.episodes) }}</span>
                  <strong>{{ seriesProgress(series.episodes).percentage }} %</strong>
                </div>
                <div
                  class="podcast-series-progress-track"
                  role="progressbar"
                  :aria-label="`Hörfortschritt: ${series.title}`"
                  :aria-valuenow="seriesProgress(series.episodes).percentage"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  :aria-valuetext="progressValueText(series.title, series.episodes)"
                >
                  <span :style="{ width: `${seriesProgress(series.episodes).percentage}%` }" />
                </div>
              </div>
            </div>
          </UPageCard>
        </div>
      </section>
    </div>
    <div v-else class="podcast-search-empty" role="status">
      <h2>Keine passenden Podcasts gefunden.</h2>
      <p>Versuche ein anderes Rechtsgebiet, eine Reihe oder einen Folgentitel.</p>
      <UButton v-if="search" type="button" color="neutral" variant="outline" @click="resetPodcastSearch">
        Suche zurücksetzen
      </UButton>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Landmark } from 'lucide-vue-next'
import type { PodcastCatalog, PodcastEpisode } from '@shared/schemas'
import { calculatePodcastSeriesProgress } from '@shared/podcastProgress'
import { api } from '../api'
import { usePodcastPlayer } from '../podcasts/usePodcastPlayer'
import AppBreadcrumb from '../components/ui/AppBreadcrumb.vue'
import PodcastArtwork from '../components/PodcastArtwork.vue'
import AppLoadingState from '../components/ui/AppLoadingState.vue'
import type { AppBreadcrumbItem } from '../ui/breadcrumbs'
import { filterPodcastCatalog } from '../ui/podcastCatalogSearch'

const catalog = ref<PodcastCatalog | null>(null)
const search = ref('')
const loading = ref(true)
const error = ref('')
const player = usePodcastPlayer()
const breadcrumbItems: AppBreadcrumbItem[] = [
  { label: 'Home', to: { name: 'home' } },
  { label: 'Podcasts' }
]
const filteredCatalog = computed(() => filterPodcastCatalog(catalog.value ?? { legalAreas: [] }, search.value))
const podcastResultCount = computed(() =>
  filteredCatalog.value.legalAreas.reduce((total, legalArea) => total + legalArea.series.length, 0)
)

onMounted(loadCatalog)

async function loadCatalog(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    catalog.value = await api.getPodcastCatalog()
    player.setCatalog(catalog.value)
  } catch {
    error.value = 'Die Podcast-Bibliothek konnte nicht geladen werden.'
  } finally {
    loading.value = false
  }
}

function seriesProgress(episodes: PodcastEpisode[]) {
  return calculatePodcastSeriesProgress(episodes)
}

function progressLabel(episodes: PodcastEpisode[]): string {
  const progress = seriesProgress(episodes)
  const episodeLabel = progress.totalEpisodes === 1 ? 'Folge abgeschlossen' : 'Folgen abgeschlossen'
  return `${progress.completedEpisodes} von ${progress.totalEpisodes} ${episodeLabel}`
}

function progressValueText(title: string, episodes: PodcastEpisode[]): string {
  const progress = seriesProgress(episodes)
  return `${title}: ${progress.percentage} Prozent gehört, ${progressLabel(episodes)}`
}

function resetPodcastSearch(): void {
  search.value = ''
}
</script>
