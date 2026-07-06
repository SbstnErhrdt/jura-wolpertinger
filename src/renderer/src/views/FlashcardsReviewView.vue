<template>
  <section class="flashcard-review">
    <header class="review-header">
      <div>
        <AppBreadcrumb :items="breadcrumbItems" />
        <p class="eyebrow">Wiederholen</p>
        <h1>Karteikarten</h1>
      </div>
      <RouterLink class="secondary" :to="{ name: 'flashcards-collections' }">Sammlungen</RouterLink>
    </header>

    <div v-if="loading" class="empty-state">Lade Karten...</div>
    <div v-else-if="sessionCompleted" class="empty-state">
      <h2>Runde geschafft</h2>
      <p>Du kannst die Karten direkt noch einmal üben oder zurück zu deinen Sammlungen gehen.</p>
      <div class="empty-actions">
        <button type="button" @click="restartPractice">Nochmal üben</button>
        <RouterLink class="secondary" :to="{ name: 'flashcards-collections' }">Zu den Sammlungen</RouterLink>
      </div>
    </div>
    <div v-else-if="!currentCard" class="empty-state">
      <h2>{{ emptyTitle }}</h2>
      <p>{{ emptyCopy }}</p>
      <RouterLink class="secondary" :to="{ name: 'flashcards-collections' }">Zu den Sammlungen</RouterLink>
    </div>

    <article v-else class="study-card">
      <div class="study-card-toolbar">
        <div>
          <span class="study-card-kicker">{{ showBack ? 'Rückseite' : 'Vorderseite' }}</span>
          <strong>{{ currentCard.title }}</strong>
        </div>
        <span>{{ positionLabel }}</span>
        <ActionMenu label="Kartenaktionen" :items="reviewActions" />
      </div>
      <button class="study-card-face" type="button" @click="showBack = true">
        <MarkdownBlock :markdown="showBack ? currentCard.backMarkdown : currentCard.frontMarkdown" />
      </button>
      <div v-if="currentCard.tags.length" class="study-card-tags" aria-label="Tags">
        <AppBadge v-for="tag in currentCard.tags" :key="tag">{{ tag }}</AppBadge>
      </div>
      <p v-if="feedback" class="review-feedback">{{ feedback }}</p>
      <div class="review-navigation">
        <button type="button" class="secondary" :disabled="!canGoPrevious || ratingBusy" @click="previousCard">
          <span class="key-hint" aria-hidden="true">←</span>
          Vorherige
        </button>
        <button type="button" class="secondary" :disabled="ratingBusy" @click="skipCard">
          Überspringen
          <span class="key-hint" aria-hidden="true">→</span>
        </button>
      </div>
      <div v-if="showBack" class="rating-row">
        <button class="rating-option again" :disabled="ratingBusy" @click="rate(1)">
          <RotateCcw :size="18" aria-hidden="true" />
          <span>Nochmal</span>
          <kbd class="key-hint">1</kbd>
          <small>nicht sicher</small>
        </button>
        <button class="rating-option hard" :disabled="ratingBusy" @click="rate(2)">
          <TriangleAlert :size="18" aria-hidden="true" />
          <span>Schwer</span>
          <kbd class="key-hint">2</kbd>
          <small>wackelig</small>
        </button>
        <button class="rating-option good" :disabled="ratingBusy" @click="rate(3)">
          <CircleCheck :size="18" aria-hidden="true" />
          <span>Gut</span>
          <kbd class="key-hint">3</kbd>
          <small>sauber</small>
        </button>
        <button class="rating-option easy" :disabled="ratingBusy" @click="rate(4)">
          <Sparkles :size="18" aria-hidden="true" />
          <span>Leicht</span>
          <kbd class="key-hint">4</kbd>
          <small>sicher</small>
        </button>
      </div>
      <button v-else class="secondary reveal-button" @click="showBack = true">
        Rückseite zeigen
        <kbd class="key-hint">Enter</kbd>
      </button>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { CircleCheck, RotateCcw, Sparkles, Trash2, TriangleAlert } from 'lucide-vue-next'
import type { ReviewCard, ReviewRating } from '@shared/schemas'
import { api } from '../api'
import ActionMenu, { type ActionMenuItem } from '../components/ui/ActionMenu.vue'
import AppBadge from '../components/ui/AppBadge.vue'
import AppBreadcrumb, { type BreadcrumbItem } from '../components/ui/AppBreadcrumb.vue'

const route = useRoute()
const loading = ref(true)
const cards = ref<ReviewCard[]>([])
const againQueue = ref<ReviewCard[]>([])
const currentIndex = ref(0)
const showBack = ref(false)
const feedback = ref('')
const ratingBusy = ref(false)
const collectionId = computed(() => (typeof route.query.collection === 'string' ? route.query.collection : null))
const collectionName = ref('')
const hasPracticeCards = ref(false)
const sessionCompleted = ref(false)

const currentCard = computed(() => cards.value[currentIndex.value] ?? againQueue.value[0] ?? null)
const canGoPrevious = computed(() => currentIndex.value > 0 && !sessionCompleted.value)
const positionLabel = computed(() => `${Math.min(currentIndex.value + 1, cards.value.length)} / ${cards.value.length}`)
const breadcrumbItems = computed<BreadcrumbItem[]>(() => {
  const items: BreadcrumbItem[] = [
    { label: 'Home', to: { name: 'home' } },
    { label: 'Karteikarten' }
  ]
  if (collectionId.value) {
    items.push({ label: 'Sammlungen', to: { name: 'flashcards-collections' } })
    items.push({ label: collectionName.value || 'Sammlung', to: { name: 'flashcards-collection', params: { id: collectionId.value } } })
  }
  items.push({ label: 'Wiederholen' })
  return items
})
const emptyTitle = computed(() => (!hasPracticeCards.value ? 'Noch keine Karten' : 'Karten bereit'))
const emptyCopy = computed(() => {
  if (!hasPracticeCards.value && collectionId.value) {
    return 'Erstelle in dieser Sammlung zuerst eine Karteikarte.'
  }
  if (!hasPracticeCards.value) {
    return 'Erstelle zuerst eine Karteikarte in einer Sammlung.'
  }
  return 'Starte die Übungsrunde mit den vorhandenen Karten.'
})
const reviewActions = computed<ActionMenuItem[]>(() => [
  {
    label: 'Aus Session entfernen',
    icon: Trash2,
    action: removeFromSession
  }
])

onMounted(() => {
  window.addEventListener('keydown', handleReviewKeydown)
  void load()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleReviewKeydown)
})

async function load(): Promise<void> {
  loading.value = true
  sessionCompleted.value = false
  if (collectionId.value) {
    const collections = await api.listLearningCollections()
    collectionName.value = collections.find((collection) => collection.id === collectionId.value)?.name ?? ''
  } else {
    collectionName.value = ''
  }
  cards.value = await api.getReviewBatch({
    collectionId: collectionId.value,
    limit: 40
  })
  if (!cards.value.length) {
    const collectionCards = await api.listLearningCards(collectionId.value)
    hasPracticeCards.value = collectionCards.length > 0
    cards.value = collectionCards.slice(0, 40)
  } else {
    hasPracticeCards.value = cards.value.length > 0
  }
  currentIndex.value = 0
  showBack.value = false
  loading.value = false
}

async function restartPractice(): Promise<void> {
  await load()
}

async function rate(rating: ReviewRating): Promise<void> {
  const card = currentCard.value
  if (!card || ratingBusy.value) return
  ratingBusy.value = true
  try {
    const result = await api.recordReview({ cardId: card.id, rating })
    feedback.value = result.intervalLabel
    if (rating === 1) againQueue.value.push(card)
    window.setTimeout(nextCard, 550)
  } catch (error) {
    ratingBusy.value = false
    throw error
  }
}

function nextCard(): void {
  ratingBusy.value = false
  feedback.value = ''
  showBack.value = false
  if (currentIndex.value < cards.value.length - 1) {
    currentIndex.value += 1
    return
  }
  if (againQueue.value.length > 0) {
    cards.value = [...againQueue.value]
    againQueue.value = []
    currentIndex.value = 0
    return
  }
  cards.value = []
  currentIndex.value = 0
  sessionCompleted.value = true
}

function previousCard(): void {
  if (!canGoPrevious.value || ratingBusy.value) return
  currentIndex.value -= 1
  feedback.value = ''
  showBack.value = false
}

function skipCard(): void {
  if (!currentCard.value || ratingBusy.value) return
  nextCard()
}

function removeFromSession(): void {
  cards.value.splice(currentIndex.value, 1)
  if (currentIndex.value >= cards.value.length && currentIndex.value > 0) currentIndex.value -= 1
  showBack.value = false
}

function handleReviewKeydown(event: KeyboardEvent): void {
  if (event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) return
  if (!currentCard.value || loading.value || sessionCompleted.value) return

  if (event.key === 'Enter' && !showBack.value) {
    event.preventDefault()
    showBack.value = true
    return
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    previousCard()
    return
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    skipCard()
    return
  }

  if (showBack.value && ['1', '2', '3', '4'].includes(event.key)) {
    event.preventDefault()
    void rate(Number(event.key) as ReviewRating)
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

const MarkdownBlock = defineComponent({
  props: {
    markdown: {
      type: String,
      required: true
    }
  },
  setup(props) {
    return () =>
      h(
        'div',
        { class: 'markdown-block' },
        props.markdown.split(/\n{2,}/).map((paragraph) => h('p', paragraph))
      )
  }
})
</script>
