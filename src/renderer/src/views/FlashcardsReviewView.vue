<template>
  <section class="flashcard-review">
    <header class="review-header">
      <div>
        <p class="eyebrow">Wiederholen</p>
        <h1>Karteikarten</h1>
      </div>
      <RouterLink class="secondary" :to="{ name: 'flashcards-collections' }">Sammlungen</RouterLink>
    </header>

    <div v-if="loading" class="empty-state">Lade Karten...</div>
    <div v-else-if="!currentCard" class="empty-state">
      <h2>Keine Karten fällig</h2>
      <p>Wähle eine Karteikarten-Datei aus oder lege neue Karten in deinen Sammlungen an.</p>
      <RouterLink class="secondary" :to="{ name: 'flashcards-collections' }">Zu den Sammlungen</RouterLink>
    </div>

    <article v-else class="study-card">
      <div class="study-card-toolbar">
        <div>
          <span class="study-card-kicker">{{ showBack ? 'Rückseite' : 'Vorderseite' }}</span>
          <strong>{{ currentCard.title }}</strong>
        </div>
        <span>{{ positionLabel }}</span>
        <details>
          <summary>Aktionen</summary>
          <button type="button" class="secondary" @click="removeFromSession">Aus Session entfernen</button>
        </details>
      </div>
      <button class="study-card-face" type="button" @click="showBack = true">
        <MarkdownBlock :markdown="showBack ? currentCard.backMarkdown : currentCard.frontMarkdown" />
      </button>
      <div v-if="currentCard.tags.length" class="study-card-tags" aria-label="Tags">
        <span v-for="tag in currentCard.tags" :key="tag" class="tag">{{ tag }}</span>
      </div>
      <p v-if="feedback" class="review-feedback">{{ feedback }}</p>
      <div v-if="showBack" class="rating-row">
        <button class="rating-option again" @click="rate(1)">
          <RotateCcw :size="18" aria-hidden="true" />
          <span>Nochmal</span>
          <small>nicht sicher</small>
        </button>
        <button class="rating-option hard" @click="rate(2)">
          <TriangleAlert :size="18" aria-hidden="true" />
          <span>Schwer</span>
          <small>wackelig</small>
        </button>
        <button class="rating-option good" @click="rate(3)">
          <CircleCheck :size="18" aria-hidden="true" />
          <span>Gut</span>
          <small>sauber</small>
        </button>
        <button class="rating-option easy" @click="rate(4)">
          <Sparkles :size="18" aria-hidden="true" />
          <span>Leicht</span>
          <small>sicher</small>
        </button>
      </div>
      <button v-else class="secondary reveal-button" @click="showBack = true">Rückseite zeigen</button>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { CircleCheck, RotateCcw, Sparkles, TriangleAlert } from 'lucide-vue-next'
import type { ReviewCard, ReviewRating } from '@shared/schemas'
import { api } from '../api'

const route = useRoute()
const loading = ref(true)
const cards = ref<ReviewCard[]>([])
const againQueue = ref<ReviewCard[]>([])
const currentIndex = ref(0)
const showBack = ref(false)
const feedback = ref('')

const currentCard = computed(() => cards.value[currentIndex.value] ?? againQueue.value[0] ?? null)
const positionLabel = computed(() => `${Math.min(currentIndex.value + 1, cards.value.length)} / ${cards.value.length}`)

onMounted(load)

async function load(): Promise<void> {
  loading.value = true
  cards.value = await api.getReviewBatch({
    collectionId: typeof route.query.collection === 'string' ? route.query.collection : null,
    limit: 40
  })
  currentIndex.value = 0
  showBack.value = false
  loading.value = false
}

async function rate(rating: ReviewRating): Promise<void> {
  const card = currentCard.value
  if (!card) return
  const result = await api.recordReview({ cardId: card.id, rating })
  feedback.value = result.intervalLabel
  if (rating === 1) againQueue.value.push(card)
  window.setTimeout(nextCard, 550)
}

function nextCard(): void {
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
}

function removeFromSession(): void {
  cards.value.splice(currentIndex.value, 1)
  showBack.value = false
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
