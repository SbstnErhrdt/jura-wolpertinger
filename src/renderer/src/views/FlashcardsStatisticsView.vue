<template>
  <section class="page flashcards-page learning-statistics-view">
    <header class="page-header">
      <div>
        <AppBreadcrumb :items="breadcrumbItems" />
        <p class="eyebrow">Karteikarten</p>
        <h1>Lernstatistik</h1>
        <p>Dein Fortschritt über alle Karten und Sammlungen.</p>
      </div>
      <UButton color="neutral" variant="outline" :to="{ name: 'flashcards-review' }">
        <Play :size="17" aria-hidden="true" />
        Weiterlernen
      </UButton>
    </header>

    <div v-if="loading" class="statistics-skeleton" aria-label="Statistik wird geladen">
      <USkeleton v-for="index in 4" :key="index" class="statistics-skeleton-tile" />
      <USkeleton class="statistics-skeleton-chart" />
    </div>
    <UAlert v-else-if="error" color="error" :description="error" />

    <template v-else-if="statistics">
      <div class="statistics-metrics">
        <UCard>
          <span>Einmal bearbeitet</span>
          <strong>{{ statistics.reviewedCards }} / {{ statistics.totalCards }}</strong>
          <small>{{ coveragePercent }} % deiner Karten</small>
        </UCard>
        <UCard>
          <span>Heute</span>
          <strong>{{ statistics.reviewsToday }}</strong>
          <small>Wiederholungen</small>
        </UCard>
        <UCard>
          <span>Letzte 7 Tage</span>
          <strong>{{ statistics.reviewsLast7Days }}</strong>
          <small>Wiederholungen</small>
        </UCard>
        <UCard>
          <span>Lernserie</span>
          <strong>{{ statistics.streakDays }}</strong>
          <small>{{ statistics.streakDays === 1 ? 'Tag' : 'Tage' }}</small>
        </UCard>
      </div>

      <div class="statistics-grid">
        <section class="statistics-panel" aria-labelledby="activity-title">
          <div class="statistics-panel-heading">
            <div>
              <p class="eyebrow">Rhythmus</p>
              <h2 id="activity-title">14 Tage Aktivität</h2>
            </div>
            <span>{{ statistics.activeDaysLast14 }} aktive Tage</span>
          </div>
          <div class="activity-chart" role="img" aria-label="Wiederholungen der letzten 14 Tage">
            <div v-for="day in statistics.activity" :key="day.date" class="activity-column">
              <span class="activity-value">{{ day.reviews }}</span>
              <div class="activity-track">
                <span :style="{ height: `${activityHeight(day.reviews)}%` }" />
              </div>
              <small>{{ shortDate(day.date) }}</small>
            </div>
          </div>
        </section>

        <section class="statistics-panel" aria-labelledby="ratings-title">
          <div class="statistics-panel-heading">
            <div>
              <p class="eyebrow">Stand</p>
              <h2 id="ratings-title">Letzte Bewertung je Karte</h2>
            </div>
          </div>
          <div class="rating-distribution">
            <div v-for="rating in displayedRatings" :key="rating.rating" :class="rating.status">
              <span>{{ ratingLabels[rating.rating] }}</span>
              <div class="rating-track">
                <span :style="{ width: `${ratingWidth(rating.count)}%` }" />
              </div>
              <strong>{{ rating.count }}</strong>
            </div>
          </div>
        </section>
      </div>

      <section class="statistics-panel collection-progress-panel" aria-labelledby="collections-title">
        <div class="statistics-panel-heading">
          <div>
            <p class="eyebrow">Sammlungen</p>
            <h2 id="collections-title">Sammlungsfortschritt</h2>
          </div>
        </div>
        <div v-if="statistics.collections.length" class="collection-progress-list">
          <div v-for="collection in statistics.collections" :key="collection.id" class="collection-progress-row">
            <div>
              <RouterLink class="collection-progress-link" :to="{ name: 'flashcards-collection', params: { id: collection.id } }">
                <strong>{{ collection.name }}</strong>
                <ChevronRight :size="16" aria-hidden="true" />
              </RouterLink>
              <span>{{ collectionOverview(collection.id)?.reviewedCards ?? collection.reviewedCards }} von {{ collectionOverview(collection.id)?.eligibleCards ?? collection.cardCount }} lernbaren Karten einmal bearbeitet</span>
            </div>
            <LearningStatusBar
              :total="collectionOverview(collection.id)?.eligibleCards ?? collection.cardCount"
              :counts="collectionStatusCounts(collection.id)"
              :label="`Lernstand ${collection.name}`"
            />
            <span>{{ collection.dueCount }} empfohlen</span>
            <span>
              Ø {{ collection.averageRating === null ? '–' : collection.averageRating.toFixed(1) }}
            </span>
          </div>
        </div>
        <div v-else class="statistics-empty">
          <p>Noch keine Sammlungen vorhanden.</p>
          <UButton :to="{ name: 'flashcards-collections' }">Sammlung anlegen</UButton>
        </div>
      </section>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ChevronRight, Play } from 'lucide-vue-next'
import type { LearningStatistics, ReviewRating } from '@shared/schemas'
import type { StudyOverview } from '@shared/flashcardStudy'
import type { LearningStatusCounts } from '@shared/learningStatus'
import { api } from '../api'
import AppBreadcrumb from '../components/ui/AppBreadcrumb.vue'
import LearningStatusBar from '../components/LearningStatusBar.vue'
import type { AppBreadcrumbItem } from '../ui/breadcrumbs'

const statistics = ref<LearningStatistics | null>(null)
const studyOverviews = ref<StudyOverview[]>([])
const loading = ref(true)
const error = ref('')
const breadcrumbItems: AppBreadcrumbItem[] = [
  { label: 'Home', to: { name: 'home' } },
  { label: 'Karteikarten', to: { name: 'flashcards' } },
  { label: 'Statistik' }
]
const ratingLabels: Record<ReviewRating, string> = {
  1: 'Nicht gewusst',
  2: 'Teilweise gewusst',
  3: 'Gewusst',
  4: 'Früher leicht'
}
const ratingStatusClasses = {
  1: 'rating-status-not-known',
  2: 'rating-status-partially-known',
  3: 'rating-status-known'
} as const
const coveragePercent = computed(() =>
  statistics.value?.totalCards
    ? Math.round((statistics.value.reviewedCards / statistics.value.totalCards) * 100)
    : 0
)
const displayedRatings = computed(() => [1, 2, 3].map((rating) => ({
  rating: rating as ReviewRating,
  status: ratingStatusClasses[rating as keyof typeof ratingStatusClasses],
  count: (statistics.value?.ratingCounts ?? []).filter((item) => rating === 3 ? item.rating >= 3 : item.rating === rating).reduce((sum, item) => sum + item.count, 0)
})))
const maximumActivity = computed(() =>
  Math.max(1, ...(statistics.value?.activity.map((day) => day.reviews) ?? [1]))
)
const maximumRating = computed(() =>
  Math.max(1, ...displayedRatings.value.map((rating) => rating.count))
)

onMounted(async () => {
  try {
    const [result, study] = await Promise.all([api.getLearningStatistics(), api.studyFlashcards({ action: 'overview' })])
    studyOverviews.value = study.overviews
    statistics.value = { ...result, collections: result.collections.map((collection) => ({ ...collection, dueCount: study.overviews.find((overview) => overview.collectionId === collection.id)?.dueCards ?? 0 })) }
  } catch {
    error.value = 'Deine Lernstatistik konnte nicht geladen werden.'
  } finally {
    loading.value = false
  }
})

function activityHeight(reviews: number): number {
  return reviews ? Math.max(8, (reviews / maximumActivity.value) * 100) : 0
}

function ratingWidth(count: number): number {
  return count ? Math.max(5, (count / maximumRating.value) * 100) : 0
}

function collectionOverview(collectionId: string): StudyOverview | undefined {
  return studyOverviews.value.find((overview) => overview.collectionId === collectionId)
}

function collectionStatusCounts(collectionId: string): LearningStatusCounts {
  return collectionOverview(collectionId)?.statusCounts ?? { notKnown: 0, partiallyKnown: 0, known: 0 }
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' }).format(
    new Date(`${value}T12:00:00`)
  )
}
</script>
