<template>
  <section class="page flashcards-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">Sammlung</p>
        <h1>{{ collection?.name || 'Sammlung' }}</h1>
        <p>{{ collection?.subject || 'Allgemein' }} · {{ cards.length }} Karten · {{ collection?.dueCount ?? 0 }} fällig</p>
      </div>
      <div class="header-actions">
        <RouterLink class="secondary" :to="{ name: 'flashcards-collections' }">Zurück</RouterLink>
        <RouterLink class="secondary" :to="{ name: 'flashcards-review', query: { collection: collectionId } }">
          Wiederholen
        </RouterLink>
        <button type="button" @click="openCreateCardDialog">
          <Plus :size="17" aria-hidden="true" />
          Neue Karteikarte
        </button>
      </div>
    </header>

    <p v-if="transferMessage" class="action-notice">{{ transferMessage }}</p>

    <div class="collection-toolbar">
      <label class="dialog-field">
        Suchen
        <input v-model="search" placeholder="Titel, Vorderseite, Rückseite oder Schlagwort" />
      </label>
      <label class="dialog-field">
        Sortieren
        <select v-model="sortMode">
          <option value="updated">Zuletzt bearbeitet</option>
          <option value="title">Titel</option>
          <option value="due">Fälligkeit</option>
          <option value="rating">Letzte Bewertung</option>
        </select>
      </label>
    </div>

    <div v-if="!filteredCards.length" class="empty-state">
      <h2>Noch keine Karteikarten</h2>
      <p>Erstelle die erste Karteikarte direkt in dieser Sammlung.</p>
      <button type="button" @click="openCreateCardDialog">Neue Karteikarte</button>
    </div>

    <div v-else class="card-list">
      <article v-for="card in filteredCards" :key="card.id" class="flashcard-list-card">
        <div class="flashcard-list-main">
          <h2>{{ card.title }}</h2>
          <p>{{ preview(card.frontMarkdown) }}</p>
          <div v-if="card.tags.length" class="study-card-tags" aria-label="Schlagwörter">
            <AppBadge v-for="tag in card.tags" :key="tag">{{ tag }}</AppBadge>
          </div>
        </div>
        <dl class="card-performance">
          <div>
            <dt>Fällig</dt>
            <dd>{{ dueLabel(card.dueAt) }}</dd>
          </div>
          <div>
            <dt>Letzte Bewertung</dt>
            <dd>{{ ratingLabel(card.lastRating) }}</dd>
          </div>
          <div>
            <dt>Wiederholungen</dt>
            <dd>{{ card.reps }}</dd>
          </div>
          <div>
            <dt>Nochmal</dt>
            <dd>{{ card.lapses }}</dd>
          </div>
        </dl>
        <ActionMenu label="Karteikartenaktionen" :items="cardActions(card)" />
      </article>
    </div>

    <div v-if="showCardDialog" class="dialog-backdrop" @click="cancelCardDialog">
      <div class="dialog-card dialog-card-wide" @click.stop>
        <h2>{{ editingCard ? 'Karteikarte bearbeiten' : 'Neue Karteikarte' }}</h2>
        <p class="dialog-copy">
          {{ editingCard ? 'Passe die Karteikarte an.' : `Diese Karte wird in der Sammlung „${collection?.name}“ gespeichert.` }}
        </p>
        <form class="dialog-form" @submit.prevent="saveCard">
          <label class="dialog-field">
            Titel
            <input v-model="cardTitle" placeholder="Kurzer Titel, z. B. Abmahnung" autofocus />
          </label>
          <label class="dialog-field">
            Vorderseite
            <textarea v-model="cardFront" rows="4" placeholder="Was soll auf der Vorderseite stehen?" />
          </label>
          <label class="dialog-field">
            Rückseite
            <textarea v-model="cardBack" rows="5" placeholder="Was soll auf der Rückseite stehen?" />
          </label>
          <div class="dialog-field">
            <span>Schlagwörter</span>
            <TagInput v-model="cardTags" :suggestions="tagSuggestions" placeholder="Schlagwörter hinzufügen" />
          </div>
          <div class="dialog-actions">
            <button type="button" class="secondary" @click="cancelCardDialog">Abbrechen</button>
            <button type="submit" :disabled="!canCreateCard">
              <Save :size="17" aria-hidden="true" />
              {{ editingCard ? 'Änderungen speichern' : 'Karteikarte speichern' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import { computed, onMounted, ref } from 'vue'
import { Pencil, Plus, Save } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import type { LearningCard, LearningCollection, ReviewRating } from '@shared/schemas'
import { api } from '../api'
import TagInput from '../components/TagInput.vue'
import ActionMenu, { type ActionMenuItem } from '../components/ui/ActionMenu.vue'
import AppBadge from '../components/ui/AppBadge.vue'

const route = useRoute()
const router = useRouter()
const collectionId = computed(() => String(route.params.id))
const collection = ref<LearningCollection | null>(null)
const cards = ref<LearningCard[]>([])
const search = ref('')
const sortMode = ref<'updated' | 'title' | 'due' | 'rating'>('updated')
const transferMessage = ref('')
const showCardDialog = ref(false)
const editingCard = ref<LearningCard | null>(null)
const cardTitle = ref('')
const cardFront = ref('')
const cardBack = ref('')
const cardTags = ref<string[]>([])
const canCreateCard = computed(() => Boolean(cardFront.value.trim()) && Boolean(cardBack.value.trim()))
const tagSuggestions = computed(() =>
  [...new Set(cards.value.flatMap((card) => card.tags).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de-DE'))
)
const filteredCards = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('de-DE')
  const result = cards.value.filter((card) => {
    if (!query) return true
    return [card.title, card.frontMarkdown, card.backMarkdown, ...card.tags]
      .join(' ')
      .toLocaleLowerCase('de-DE')
      .includes(query)
  })

  return [...result].sort((left, right) => {
    if (sortMode.value === 'title') return left.title.localeCompare(right.title, 'de-DE')
    if (sortMode.value === 'due') return left.dueAt.localeCompare(right.dueAt)
    if (sortMode.value === 'rating') return (right.lastRating ?? 0) - (left.lastRating ?? 0)
    return right.updatedAt.localeCompare(left.updatedAt)
  })
})

onMounted(load)

async function load(): Promise<void> {
  const [collections, nextCards] = await Promise.all([
    api.listLearningCollections(),
    api.listLearningCards(collectionId.value)
  ])
  collection.value = collections.find((candidate) => candidate.id === collectionId.value) ?? null
  cards.value = nextCards
  if (!collection.value) await router.replace({ name: 'flashcards-collections' })
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
  await load()
}

function cardActions(card: LearningCard): ActionMenuItem[] {
  return [
    {
      label: 'Karteikarte bearbeiten',
      icon: Pencil as Component,
      action: () => openEditCardDialog(card)
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

function dueLabel(value: string): string {
  const due = new Date(value)
  const today = new Date()
  due.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  if (due.getTime() <= today.getTime()) return 'Jetzt'
  return due.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
</script>
