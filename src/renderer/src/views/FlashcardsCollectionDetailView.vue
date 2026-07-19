<template>
  <section class="page flashcards-page">
    <header class="page-header">
      <div>
        <UBreadcrumb class="app-breadcrumb" :items="withHomeIcon(breadcrumbItems)" />
        <p class="eyebrow">Sammlung</p>
        <h1>{{ collection?.name || 'Sammlung' }}</h1>
        <p>{{ collection?.subject || 'Allgemein' }} · {{ cardsTotal }} Karten · {{ collection?.dueCount ?? 0 }} empfohlen</p>
      </div>
      <div class="header-actions">
        <UButton color="neutral" variant="outline" :to="{ name: 'flashcards-collections' }">Zurück</UButton>
        <UButton color="neutral" variant="outline" :to="{ name: 'flashcards-review', query: { collection: collectionId } }">
          Wiederholen
        </UButton>
        <UButton type="button" @click="openCreateCardDialog">
          <Plus :size="17" aria-hidden="true" />
          Neue Karteikarte
        </UButton>
      </div>
    </header>

    <UAlert v-if="transferMessage" class="action-notice" color="success" :description="transferMessage" />

    <div class="collection-toolbar">
      <UFormField class="dialog-field" label="Suchen"><UInput v-model="search" placeholder="Titel, Vorderseite, Rückseite oder Schlagwort" /></UFormField>
      <UFormField class="dialog-field" label="Sortieren"><USelect v-model="sortMode" :items="sortOptions" value-key="value" /></UFormField>
    </div>

    <div v-if="loading" class="skeleton-list" aria-hidden="true">
      <UCard v-for="index in 4" :key="index" class="skeleton-tile"><USkeleton class="h-5 w-2/5" /><USkeleton class="mt-3 h-4 w-full" /><USkeleton class="mt-2 h-4 w-3/5" /></UCard>
    </div>
    <UAlert v-else-if="loadError" class="action-notice" color="error" :description="loadError">
      <template #actions><UButton color="neutral" variant="outline" @click="reloadCards">Erneut versuchen</UButton></template>
    </UAlert>

    <div v-else-if="!filteredCards.length" class="empty-state">
      <h2>Noch keine Karteikarten</h2>
      <p>{{ search.trim() ? 'Keine Karteikarte passt zur aktuellen Suche.' : 'Erstelle die erste Karteikarte direkt in dieser Sammlung.' }}</p>
      <UButton type="button" @click="openCreateCardDialog">Neue Karteikarte</UButton>
    </div>

    <div
      v-else
      class="card-list"
      :class="{ 'paginated-list-refreshing': refreshing }"
      :aria-busy="refreshing"
    >
      <article v-for="card in filteredCards" :key="card.id" class="flashcard-list-card">
        <div class="flashcard-list-main">
          <h2>{{ card.title }}</h2>
          <p>{{ preview(card.frontMarkdown) }}</p>
          <div v-if="card.tags.length" class="study-card-tags" aria-label="Schlagwörter">
            <UBadge v-for="tag in card.tags" :key="tag" variant="soft">{{ tag }}</UBadge>
          </div>
        </div>
        <dl class="card-performance">
          <div class="performance-cell">
            <dt>Empfehlung</dt>
            <dd>{{ dueLabel(card.dueAt) }}</dd>
          </div>
          <div :class="['performance-cell', 'performance-cell-rating', ratingStatusClass(card.lastRating)]">
            <dt>Letzte Bewertung</dt>
            <dd>{{ ratingLabel(card.lastRating) }}</dd>
          </div>
          <div class="performance-cell">
            <dt>Wiederholungen</dt>
            <dd>{{ card.reps }}</dd>
          </div>
          <div class="performance-cell">
            <dt>Nochmal</dt>
            <dd>{{ card.lapses }}</dd>
          </div>
        </dl>
        <UDropdownMenu :items="cardActions(card)">
          <UButton color="neutral" variant="ghost" icon="i-lucide-ellipsis" aria-label="Karteikartenaktionen" />
        </UDropdownMenu>
      </article>
    </div>
    <nav
      v-if="!loading && !loadError && cardsTotal > 0"
      class="app-pagination"
      label="Karteikartenseiten"
    >
      <span>{{ (cardsPage - 1) * cardsPageSize + 1 }}-{{ Math.min(cardsTotal, cardsPage * cardsPageSize) }} von {{ cardsTotal }}</span>
      <UPagination :model-value="cardsPage" :total="cardsTotal" :items-per-page="cardsPageSize" :disabled="refreshing" @update:model-value="setCardsPage" />
      <USelect :model-value="cardsPageSize" :items="pageSizeOptions" :disabled="refreshing" @update:model-value="setCardsPageSize" />
    </nav>

    <UModal :open="showCardDialog" @update:open="showCardDialog = $event">
      <template #content>
      <div class="dialog-card dialog-card-wide">
        <h2>{{ editingCard ? 'Karteikarte bearbeiten' : 'Neue Karteikarte' }}</h2>
        <p class="dialog-copy">
          {{ editingCard ? 'Passe die Karteikarte an.' : `Diese Karte wird in der Sammlung „${collection?.name}“ gespeichert.` }}
        </p>
        <form class="dialog-form" @submit.prevent="saveCard">
          <UFormField class="dialog-field" label="Titel"><UInput v-model="cardTitle" placeholder="Kurzer Titel, z. B. Abmahnung" autofocus /></UFormField>
          <UFormField class="dialog-field" label="Vorderseite"><UTextarea v-model="cardFront" :rows="4" placeholder="Was soll auf der Vorderseite stehen?" /></UFormField>
          <UFormField class="dialog-field" label="Rückseite"><UTextarea v-model="cardBack" :rows="5" placeholder="Was soll auf der Rückseite stehen?" /></UFormField>
          <div class="dialog-field">
            <span>Schlagwörter</span>
            <TagInput v-model="cardTags" :suggestions="tagSuggestions" placeholder="Schlagwörter hinzufügen" />
          </div>
          <div class="dialog-actions">
            <UButton type="button" color="neutral" variant="outline" @click="cancelCardDialog">Abbrechen</UButton>
            <UButton type="submit" :disabled="!canCreateCard">
              <Save :size="17" aria-hidden="true" />
              {{ editingCard ? 'Änderungen speichern' : 'Karteikarte speichern' }}
            </UButton>
          </div>
        </form>
      </div>
      </template>
    </UModal>

    <UModal :open="Boolean(deleteCardTarget)" @update:open="!$event && cancelDeleteCard()">
      <template #content>
        <div class="dialog-card">
          <h2>Karteikarte löschen</h2>
          <p class="dialog-copy">
            Die Karte „{{ deleteCardTarget?.title || 'Ohne Titel' }}“ wird aus dieser Sammlung entfernt.
          </p>
          <div class="dialog-actions">
            <UButton type="button" color="neutral" variant="outline" :disabled="deleteCardBusy" @click="cancelDeleteCard">
              Abbrechen
            </UButton>
            <UButton type="button" color="error" :loading="deleteCardBusy" @click="confirmDeleteCard">
              Löschen
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Plus, Save } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import type { LearningCard, LearningCollection, ReviewRating } from '@shared/schemas'
import { api } from '../api'
import TagInput from '../components/TagInput.vue'
import type { AppActionMenuItem } from '../ui/actionMenu'
import { type AppBreadcrumbItem, withHomeIcon } from '../ui/breadcrumbs'

const route = useRoute()
const router = useRouter()
const collectionId = computed(() => String(route.params.id))
const collection = ref<LearningCollection | null>(null)
const cards = ref<LearningCard[]>([])
const search = ref('')
const sortMode = ref<'updated' | 'title' | 'due' | 'rating'>('updated')
const loading = ref(true)
const refreshing = ref(false)
const loadError = ref('')
const cardsPage = ref(1)
const cardsPageSize = ref(25)
const cardsPageCount = ref(1)
const cardsTotal = ref(0)
const pageSizeOptions = [10, 25, 50, 100]
const sortOptions = [
  { label: 'Zuletzt bearbeitet', value: 'updated' },
  { label: 'Titel', value: 'title' },
  { label: 'Empfehlung', value: 'due' },
  { label: 'Letzte Bewertung', value: 'rating' }
]
const transferMessage = ref('')
const showCardDialog = ref(false)
const editingCard = ref<LearningCard | null>(null)
const cardTitle = ref('')
const cardFront = ref('')
const cardBack = ref('')
const cardTags = ref<string[]>([])
const deleteCardTarget = ref<LearningCard | null>(null)
const deleteCardBusy = ref(false)
const canCreateCard = computed(() => Boolean(cardFront.value.trim()) && Boolean(cardBack.value.trim()))
const breadcrumbItems = computed<AppBreadcrumbItem[]>(() => [
  { label: 'Home', to: { name: 'home' } },
  { label: 'Karteikarten', to: { name: 'flashcards' } },
  { label: 'Sammlungen', to: { name: 'flashcards-collections' } },
  { label: collection.value?.name || 'Sammlung' }
])
const tagSuggestions = computed(() =>
  [...new Set(cards.value.flatMap((card) => card.tags).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de-DE'))
)
const filteredCards = computed(() => {
  return cards.value
})

onMounted(load)

watch([search, sortMode], () => {
  void loadCards({ page: 1 })
})

async function load(): Promise<void> {
  loading.value = true
  loadError.value = ''
  try {
    const collections = await api.listLearningCollections()
    collection.value = collections.find((candidate) => candidate.id === collectionId.value) ?? null
    if (!collection.value) {
      await router.replace({ name: 'flashcards-collections' })
      return
    }
    await loadCards({ page: 1 })
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Karteikarten konnten nicht geladen werden.'
  } finally {
    loading.value = false
  }
}

async function loadCards(input: { page?: number; pageSize?: number } = {}): Promise<void> {
  refreshing.value = !loading.value
  loadError.value = ''
  try {
    const page = await api.listLearningCardsPage({
      collectionId: collectionId.value,
      search: search.value,
      sort: sortMode.value,
      page: input.page ?? cardsPage.value,
      pageSize: input.pageSize ?? cardsPageSize.value
    })
    cards.value = page.items
    cardsPage.value = page.page
    cardsPageSize.value = page.pageSize
    cardsPageCount.value = page.pageCount
    cardsTotal.value = page.total
    if (!page.items.length && page.page > 1) {
      await loadCards({ page: page.page - 1 })
    }
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Karteikarten konnten nicht geladen werden.'
  } finally {
    refreshing.value = false
  }
}

async function reloadCards(): Promise<void> {
  await loadCards()
}

async function setCardsPage(page: number): Promise<void> {
  await loadCards({ page })
}

async function setCardsPageSize(pageSize: number): Promise<void> {
  await loadCards({ page: 1, pageSize })
}

function openCreateCardDialog(): void {
  editingCard.value = null
  cardTitle.value = ''
  cardFront.value = ''
  cardBack.value = ''
  cardTags.value = []
  showCardDialog.value = true
}

function openEditCardDialog(card: LearningCard): void {
  editingCard.value = card
  cardTitle.value = card.title
  cardFront.value = card.frontMarkdown
  cardBack.value = card.backMarkdown
  cardTags.value = [...card.tags]
  showCardDialog.value = true
}

function cancelCardDialog(): void {
  showCardDialog.value = false
  editingCard.value = null
}

async function saveCard(): Promise<void> {
  if (!canCreateCard.value) return
  const input = {
    collectionId: collectionId.value,
    title: cardTitle.value,
    frontMarkdown: cardFront.value,
    backMarkdown: cardBack.value,
    tags: [...cardTags.value]
  }
  if (editingCard.value) {
    await api.updateLearningCard({ id: editingCard.value.id, ...input })
    transferMessage.value = 'Karteikarte aktualisiert.'
  } else {
    await api.createLearningCard(input)
    transferMessage.value = 'Karteikarte gespeichert.'
  }
  showCardDialog.value = false
  editingCard.value = null
  await loadCards()
}

function openDeleteCardDialog(card: LearningCard): void {
  deleteCardTarget.value = card
}

function cancelDeleteCard(): void {
  if (deleteCardBusy.value) return
  deleteCardTarget.value = null
}

async function confirmDeleteCard(): Promise<void> {
  if (!deleteCardTarget.value) return
  deleteCardBusy.value = true
  try {
    await api.deleteLearningCard({ id: deleteCardTarget.value.id })
    transferMessage.value = 'Karteikarte gelöscht.'
    deleteCardTarget.value = null
    await loadCards()
  } finally {
    deleteCardBusy.value = false
  }
}

function cardActions(card: LearningCard): AppActionMenuItem[] {
  return [
    {
      label: 'Karteikarte bearbeiten',
      icon: 'i-lucide-pencil',
      onSelect: () => openEditCardDialog(card)
    },
    {
      label: 'Karteikarte löschen',
      icon: 'i-lucide-trash-2',
      color: 'error',
      onSelect: () => openDeleteCardDialog(card)
    }
  ]
}

function preview(markdown: string): string {
  return markdown.replace(/\s+/g, ' ').trim().slice(0, 180)
}

function ratingLabel(rating: ReviewRating | null): string {
  if (rating === 1) return 'Nochmal'
  if (rating === 2) return 'Schwer'
  if (rating === 3) return 'Gut'
  if (rating === 4) return 'Leicht'
  return 'Noch nicht bewertet'
}

function ratingStatusClass(rating: ReviewRating | null): string {
  if (rating === 1) return 'status-rating-again'
  if (rating === 2) return 'status-rating-hard'
  if (rating === 3) return 'status-rating-good'
  if (rating === 4) return 'status-rating-easy'
  return 'status-rating-empty'
}

function dueLabel(value: string): string {
  const due = new Date(value)
  const today = new Date()
  due.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  if (due.getTime() <= today.getTime()) return 'Jetzt'
  return due.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
</script>
