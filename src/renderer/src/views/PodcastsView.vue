<template>
  <section class="page podcasts-view">
    <header class="page-header">
      <div>
        <UBreadcrumb class="app-breadcrumb" :items="withHomeIcon(breadcrumbItems)" />
        <p class="eyebrow">Audio lernen</p>
        <h1>Podcasts</h1>
        <p>Juristische Lernreihen für unterwegs und zwischendurch.</p>
      </div>
    </header>

    <div v-if="loading" class="podcast-library-skeleton" aria-label="Podcasts werden geladen">
      <USkeleton class="podcast-skeleton-title" />
      <USkeleton v-for="index in 3" :key="index" class="podcast-skeleton-card" />
    </div>
    <UAlert v-else-if="error" color="error" :description="error" />
    <div v-else class="podcast-legal-areas">
      <section v-for="legalArea in catalog?.legalAreas" :key="legalArea.slug">
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
            <div class="podcast-cover" aria-hidden="true">
              <img src="/assets/icon.png" alt="" />
              <span>Jura<br />Audio</span>
            </div>
            <div class="podcast-series-copy">
              <p>{{ series.edition }}</p>
              <h3>{{ series.title }}</h3>
              <span>{{ series.description }}</span>
              <small>
                {{ series.episodes.length }} Folgen · {{ completedEpisodes(series.episodes) }} gehört
              </small>
            </div>
          </UPageCard>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Landmark } from 'lucide-vue-next'
import type { PodcastCatalog, PodcastEpisode } from '@shared/schemas'
import { api } from '../api'
import { usePodcastPlayer } from '../podcasts/usePodcastPlayer'
import { type AppBreadcrumbItem, withHomeIcon } from '../ui/breadcrumbs'

const catalog = ref<PodcastCatalog | null>(null)
const loading = ref(true)
const error = ref('')
const player = usePodcastPlayer()
const breadcrumbItems: AppBreadcrumbItem[] = [
  { label: 'Home', to: { name: 'home' } },
  { label: 'Podcasts' }
]

onMounted(async () => {
  try {
    catalog.value = await api.getPodcastCatalog()
    player.setCatalog(catalog.value)
  } catch {
    error.value = 'Die Podcast-Bibliothek konnte nicht geladen werden.'
  } finally {
    loading.value = false
  }
})

function completedEpisodes(episodes: PodcastEpisode[]): number {
  return episodes.filter((episode) => episode.progress?.completed).length
}
</script>
