<template>
  <section class="flashcard-review">
    <header class="review-header">
      <div>
        <UBreadcrumb class="app-breadcrumb" :items="withHomeIcon(breadcrumbItems)" />
        <p class="eyebrow">Wiederholen</p>
        <h1>Karteikarten</h1>
      </div>
      <UButton color="neutral" variant="outline" :to="{ name: 'flashcards-collections' }">Sammlungen</UButton>
    </header>

    <UCard v-if="loading" class="empty-state"><USkeleton class="h-6 w-1/3" /><USkeleton class="mt-4 h-24 w-full" /></UCard>
    <div v-else-if="sessionCompleted" class="empty-state">
      <h2>Runde geschafft</h2>
      <p>Du kannst die Karten direkt noch einmal üben oder zurück zu deinen Sammlungen gehen.</p>
      <div class="empty-actions">
        <UButton type="button" @click="restartPractice">Nochmal üben</UButton>
        <UButton color="neutral" variant="outline" :to="{ name: 'flashcards-collections' }">Zu den Sammlungen</UButton>
      </div>
    </div>
    <div v-else-if="!currentCard" class="empty-state">
      <h2>{{ emptyTitle }}</h2>
      <p>{{ emptyCopy }}</p>
      <UButton color="neutral" variant="outline" :to="{ name: 'flashcards-collections' }">Zu den Sammlungen</UButton>
    </div>

    <article v-else class="study-card">
      <div class="study-card-toolbar">
        <div>
          <span class="study-card-kicker">{{ showBack ? 'Rückseite' : 'Vorderseite' }}</span>
          <strong>{{ currentCard.title }}</strong>
        </div>
        <span>{{ positionLabel }}</span>
        <UDropdownMenu :items="reviewActions">
          <UButton color="neutral" variant="ghost" icon="i-lucide-ellipsis" aria-label="Kartenaktionen" :disabled="voiceInProgress" />
        </UDropdownMenu>
      </div>
      <UButton
        :key="`${currentCard.id}-${showBack ? 'back' : 'front'}`"
        :class="[
          'study-card-face',
          showBack ? 'study-card-face-back' : 'study-card-face-front',
          {
            'study-card-motion-flip': cardMotion === 'flip',
            'study-card-motion-next': cardMotion === 'next',
            'study-card-motion-previous': cardMotion === 'previous'
          }
        ]"
        type="button"
        color="neutral"
        variant="ghost"
        :disabled="voiceInProgress"
        @click="revealBack"
      >
        <MarkdownBlock :markdown="showBack ? currentCard.backMarkdown : currentCard.frontMarkdown" />
      </UButton>
      <div v-if="currentCard.tags.length" class="study-card-tags" aria-label="Tags">
        <UBadge v-for="tag in currentCard.tags" :key="tag" variant="soft">{{ tag }}</UBadge>
        <UBadge :class="cardQualityTone(currentCard.qualityStatus)" variant="soft">
          {{ cardQualityLabel(currentCard.qualityStatus) }}
        </UBadge>
      </div>
      <p v-if="feedback" class="review-feedback">{{ feedback }}</p>
      <div class="review-navigation">
        <UButton type="button" color="neutral" variant="outline" :disabled="!canGoPrevious || ratingBusy || voiceInProgress" @click="previousCard">
          <kbd class="key-hint" aria-hidden="true">←</kbd>
          Vorherige
        </UButton>
        <UButton type="button" color="neutral" variant="outline" :disabled="ratingBusy || voiceInProgress" @click="skipCard">
          Überspringen
          <kbd class="key-hint" aria-hidden="true">→</kbd>
        </UButton>
      </div>
      <UButton
        v-if="voiceEnabled"
        type="button"
        icon="i-lucide-mic"
        :disabled="voiceInProgress || ratingBusy"
        @click="startVoiceReview"
      >
        Mit Wolpi sprechen
      </UButton>
      <section v-if="voiceStatus !== 'idle'" class="voice-review-panel" aria-live="polite">
        <strong>{{ voiceStatusLabel }}</strong>
        <p v-if="voiceTranscript">{{ voiceTranscript }}</p>
        <p v-if="voiceError" class="review-feedback">{{ voiceError }}</p>
        <div v-if="voiceResult">
          <p>{{ voiceResult.assessment.reason }}</p>
          <p v-if="!voiceResult.recorded">Antwort konnte nicht sicher bewertet werden.</p>
        </div>
        <UButton
          v-if="voiceClient && voiceInProgress"
          type="button"
          color="neutral"
          variant="outline"
          @click="finishVoiceReview"
        >
          Antwort beenden
        </UButton>
      </section>
      <div v-if="showBack" class="rating-row">
        <UButton class="rating-option again" color="error" variant="soft" :disabled="ratingBusy || voiceInProgress" @click="rate(1)">
          <RotateCcw :size="18" aria-hidden="true" />
          <span>Nochmal</span>
          <kbd class="key-hint">1</kbd>
          <small>nicht sicher</small>
        </UButton>
        <UButton class="rating-option hard" color="warning" variant="soft" :disabled="ratingBusy || voiceInProgress" @click="rate(2)">
          <TriangleAlert :size="18" aria-hidden="true" />
          <span>Schwer</span>
          <kbd class="key-hint">2</kbd>
          <small>wackelig</small>
        </UButton>
        <UButton class="rating-option good" color="success" variant="soft" :disabled="ratingBusy || voiceInProgress" @click="rate(3)">
          <CircleCheck :size="18" aria-hidden="true" />
          <span>Gut</span>
          <kbd class="key-hint">3</kbd>
          <small>sauber</small>
        </UButton>
        <UButton class="rating-option easy" color="info" variant="soft" :disabled="ratingBusy || voiceInProgress" @click="rate(4)">
          <Sparkles :size="18" aria-hidden="true" />
          <span>Leicht</span>
          <kbd class="key-hint">4</kbd>
          <small>sicher</small>
        </UButton>
      </div>
      <UButton v-else color="neutral" variant="outline" class="reveal-button" :disabled="voiceInProgress" @click="revealBack">
        Rückseite zeigen
        <kbd class="key-hint">Enter</kbd>
      </UButton>
    </article>

    <Transition name="wolpi-milestone">
      <aside v-if="wolpiMilestone" class="wolpi-milestone" aria-live="polite">
        <div class="wolpi-milestone-image-wrap">
          <img :src="wolpiMilestone.imageUrl" alt="" class="wolpi-milestone-image" />
        </div>
        <div class="wolpi-milestone-copy">
          <span>{{ wolpiMilestone.kicker }}</span>
          <strong>{{ wolpiMilestone.title }}</strong>
          <p>{{ wolpiMilestone.copy }}</p>
        </div>
        <UButton
          class="wolpi-milestone-close"
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          aria-label="Motivation ausblenden"
          @click="dismissWolpiMilestone"
        />
      </aside>
    </Transition>

    <UModal :open="showCardDialog" @update:open="showCardDialog = $event">
      <template #content>
        <div class="dialog-card dialog-card-wide">
          <h2>Karteikarte bearbeiten</h2>
          <p class="dialog-copy">Passe die Karteikarte an. Änderungen gelten direkt für diese Karte.</p>
          <form class="dialog-form" @submit.prevent="saveCard">
            <UFormField class="dialog-field" label="Titel"><UInput v-model="cardTitle" class="dialog-control" placeholder="Kurzer Titel" autofocus /></UFormField>
            <UFormField class="dialog-field" label="Vorderseite"><UTextarea v-model="cardFront" class="dialog-control" :rows="4" placeholder="Vorderseite" /></UFormField>
            <UFormField class="dialog-field" label="Rückseite"><UTextarea v-model="cardBack" class="dialog-control" :rows="5" placeholder="Rückseite" /></UFormField>
            <div class="dialog-field">
              <span>Schlagwörter</span>
              <TagInput v-model="cardTags" :suggestions="tagSuggestions" placeholder="Schlagwörter hinzufügen" />
            </div>
            <UButton
              v-if="editingCard && cardBlockedFromReview(editingCard)"
              type="button"
              color="neutral"
              :variant="releaseAfterEdit ? 'solid' : 'outline'"
              icon="i-lucide-check"
              @click="releaseAfterEdit = !releaseAfterEdit"
            >
              Nach dem Speichern wieder zum Wiederholen freigeben
            </UButton>
            <div class="dialog-actions">
              <UButton type="button" color="neutral" variant="outline" @click="cancelCardDialog">Abbrechen</UButton>
              <UButton type="submit" :disabled="!canSaveCard" :loading="cardSaveBusy">
                <Save :size="17" aria-hidden="true" />
                Änderungen speichern
              </UButton>
            </div>
          </form>
        </div>
      </template>
    </UModal>

    <UModal :open="Boolean(qualityCardTarget)" @update:open="!$event && cancelQualityDialog()">
      <template #content>
        <div class="dialog-card dialog-card-wide">
          <h2>Kartenqualität bewerten</h2>
          <p class="dialog-copy">Bewerte hier die Karte selbst, nicht ob du die Antwort konntest.</p>
          <form class="dialog-form" @submit.prevent="saveQualityRating">
            <div class="quality-choice-grid" role="radiogroup" aria-label="Kartenqualität">
              <div
                v-for="option in cardQualityOptions"
                :key="option.value"
                :class="['quality-choice', { 'quality-choice-active': qualityStatus === option.value }]"
                role="button"
                tabindex="0"
                @click="qualityStatus = option.value"
                @keydown.enter.prevent="qualityStatus = option.value"
              >
                <strong>{{ option.label }}</strong>
                <span>{{ option.description }}</span>
              </div>
            </div>
            <div class="dialog-field">
              <span>Hinweise</span>
              <div class="quality-reason-grid">
                <UButton
                  v-for="reason in cardQualityReasonOptions"
                  :key="reason.value"
                  type="button"
                  color="neutral"
                  :variant="qualityReasons.includes(reason.value) ? 'solid' : 'outline'"
                  @click="toggleQualityReason(reason.value)"
                >
                  {{ reason.label }}
                </UButton>
              </div>
            </div>
            <UFormField class="dialog-field" label="Notiz"><UTextarea v-model="qualityNote" class="dialog-control" :rows="3" placeholder="Optionaler Hinweis zur Überarbeitung" /></UFormField>
            <div class="dialog-actions">
              <UButton type="button" color="neutral" variant="outline" @click="cancelQualityDialog">Abbrechen</UButton>
              <UButton type="submit" :loading="qualityBusy">
                <Save :size="17" aria-hidden="true" />
                Bewertung speichern
              </UButton>
            </div>
          </form>
        </div>
      </template>
    </UModal>
  </section>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { CircleCheck, RotateCcw, Save, Sparkles, TriangleAlert } from 'lucide-vue-next'
import type { FeatureFlags, VoiceSessionCompleteResult } from '@shared/ipc'
import type { LearningCard, LearningCardQualityReason, LearningCardQualityStatus, ReviewCard, ReviewRating } from '@shared/schemas'
import { api } from '../api'
import TagInput from '../components/TagInput.vue'
import { hasFeatureFlag } from '../voice/featureFlags'
import { startVoiceClient, type VoiceAssessment, type VoiceClient, type VoiceClientStatus, type VoiceCommand } from '../voice/voiceClient'
import type { AppActionMenuItem } from '../ui/actionMenu'
import { type AppBreadcrumbItem, withHomeIcon } from '../ui/breadcrumbs'
import {
  cardQualityLabel,
  cardQualityOptions,
  cardQualityReasonOptions,
  cardQualityTone
} from '../ui/flashcardQuality'

const route = useRoute()
const loading = ref(true)
const cards = ref<ReviewCard[]>([])
const againQueue = ref<ReviewCard[]>([])
const currentIndex = ref(0)
const showBack = ref(false)
const cardMotion = ref<'flip' | 'next' | 'previous'>('flip')
const feedback = ref('')
const ratingBusy = ref(false)
const featureFlags = ref<FeatureFlags>({})
const voiceStatus = ref<VoiceClientStatus>('idle')
const voiceTranscript = ref('')
const voiceResult = ref<VoiceSessionCompleteResult | null>(null)
const voiceError = ref('')
const voiceClient = ref<VoiceClient | null>(null)
const voiceSessionId = ref<string | null>(null)
const voiceAssessment = ref<VoiceAssessment | null>(null)
const wolpiIntroduced = ref(false)
const profileFirstName = ref<string | null>(null)
const collectionId = computed(() => (typeof route.query.collection === 'string' ? route.query.collection : null))
const collectionName = ref('')
const hasPracticeCards = ref(false)
const sessionCompleted = ref(false)
const reviewedCardsInSession = ref(0)
const wolpiMilestone = ref<{
  kicker: string
  title: string
  copy: string
  imageUrl: string
} | null>(null)
const showCardDialog = ref(false)
const editingCard = ref<ReviewCard | null>(null)
const cardTitle = ref('')
const cardFront = ref('')
const cardBack = ref('')
const cardTags = ref<string[]>([])
const releaseAfterEdit = ref(true)
const cardSaveBusy = ref(false)
const qualityCardTarget = ref<ReviewCard | null>(null)
const qualityStatus = ref<LearningCardQualityStatus>('good')
const qualityReasons = ref<LearningCardQualityReason[]>([])
const qualityNote = ref('')
const qualityBusy = ref(false)
let wolpiMilestoneTimer: number | null = null
let voiceRequestGeneration = 0
let voiceAbortController: AbortController | null = null

const WOLPI_MILESTONE_IMAGE_COUNT = 39
const WOLPI_MILESTONE_COPY = [
  'Kurze Pause, tiefer Atemzug, weiter geht es.',
  'Das ist genau die Art Wiederholung, die hängen bleibt.',
  'Sauber gearbeitet. Die nächste Karte wartet schon.',
  'Du machst aus einzelnen Karten echtes Prüfungstraining.',
  'Kleine Einheiten, großer Effekt.'
]

const currentCard = computed(() => cards.value[currentIndex.value] ?? againQueue.value[0] ?? null)
const voiceEnabled = computed(() => hasFeatureFlag(featureFlags.value, 'flashcards_voice_agent'))
const voiceInProgress = computed(() => ['connecting', 'listening', 'prompting', 'assessing'].includes(voiceStatus.value))
const voiceStatusLabel = computed(() => {
  const labels: Record<VoiceClientStatus, string> = {
    idle: 'Bereit',
    connecting: 'Verbindet',
    listening: 'Hört zu',
    prompting: 'Fragt nach',
    assessing: 'Bewertet',
    result: 'Ergebnis',
    uncertain: 'Nicht sicher',
    error: 'Nicht sicher'
  }
  return labels[voiceStatus.value]
})
const canGoPrevious = computed(() => currentIndex.value > 0 && !sessionCompleted.value)
const positionLabel = computed(() => `${Math.min(currentIndex.value + 1, cards.value.length)} / ${cards.value.length}`)
const canSaveCard = computed(() => Boolean(cardFront.value.trim()) && Boolean(cardBack.value.trim()))
const tagSuggestions = computed(() =>
  [...new Set(cards.value.flatMap((card) => card.tags).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de-DE'))
)
const breadcrumbItems = computed<AppBreadcrumbItem[]>(() => {
  const items: AppBreadcrumbItem[] = [
    { label: 'Home', to: { name: 'home' } },
    { label: 'Karteikarten', to: { name: 'flashcards' } }
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
const reviewActions = computed<AppActionMenuItem[]>(() => [
  {
    label: 'Karteikarte bearbeiten',
    icon: 'i-lucide-pencil',
    onSelect: () => currentCard.value && openEditCardDialog(currentCard.value)
  },
  {
    label: 'Kartenqualität bewerten',
    icon: 'i-lucide-shield-check',
    onSelect: () => currentCard.value && openQualityDialog(currentCard.value)
  },
  {
    label: 'Aus Session entfernen',
    icon: 'i-lucide-trash-2',
    color: 'error',
    onSelect: removeFromSession
  }
])

onMounted(() => {
  window.addEventListener('keydown', handleReviewKeydown)
  void load()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleReviewKeydown)
  clearWolpiMilestoneTimer()
  voiceRequestGeneration += 1
  stopVoiceClient()
})

async function load(): Promise<void> {
  loading.value = true
  clearVoiceReview()
  wolpiIntroduced.value = false
  sessionCompleted.value = false
  const [nextFeatureFlags, nextProfile] = await Promise.all([
    api.getFeatureFlags().catch(() => ({})),
    api.getUserProfile().catch(() => null)
  ])
  featureFlags.value = nextFeatureFlags
  profileFirstName.value = nextProfile?.firstName ?? null
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
    const usableCards = collectionCards.filter((card) => !cardBlockedFromReview(card))
    hasPracticeCards.value = collectionCards.length > 0
    cards.value = usableCards.slice(0, 40)
  } else {
    hasPracticeCards.value = cards.value.length > 0
  }
  currentIndex.value = 0
  showBack.value = false
  cardMotion.value = 'flip'
  reviewedCardsInSession.value = 0
  dismissWolpiMilestone()
  loading.value = false
}

function openEditCardDialog(card: ReviewCard): void {
  if (voiceInProgress.value) return
  editingCard.value = card
  cardTitle.value = card.title
  cardFront.value = card.frontMarkdown
  cardBack.value = card.backMarkdown
  cardTags.value = [...card.tags]
  releaseAfterEdit.value = cardBlockedFromReview(card)
  showCardDialog.value = true
}

function cancelCardDialog(): void {
  if (cardSaveBusy.value) return
  showCardDialog.value = false
  editingCard.value = null
}

async function saveCard(): Promise<void> {
  const card = editingCard.value
  if (!card || !canSaveCard.value) return
  cardSaveBusy.value = true
  try {
    const updated = await api.updateLearningCard({
      id: card.id,
      collectionId: card.collectionId,
      title: cardTitle.value,
      frontMarkdown: cardFront.value,
      backMarkdown: cardBack.value,
      tags: [...cardTags.value]
    })
    if (releaseAfterEdit.value && cardBlockedFromReview(card)) {
      await api.rateLearningCardQuality({ cardId: updated.id, status: 'good', reasons: [], note: '' })
    }
    replaceSessionCard(updated)
    feedback.value = 'Karteikarte aktualisiert.'
    cancelCardDialog()
  } finally {
    cardSaveBusy.value = false
  }
}

function openQualityDialog(card: ReviewCard): void {
  if (voiceInProgress.value) return
  qualityCardTarget.value = card
  qualityStatus.value = card.qualityStatus ?? 'good'
  qualityReasons.value = [...card.qualityReasons]
  qualityNote.value = card.qualityNote
}

function cancelQualityDialog(): void {
  if (qualityBusy.value) return
  qualityCardTarget.value = null
}

function toggleQualityReason(reason: LearningCardQualityReason): void {
  qualityReasons.value = qualityReasons.value.includes(reason)
    ? qualityReasons.value.filter((candidate) => candidate !== reason)
    : [...qualityReasons.value, reason]
}

async function saveQualityRating(): Promise<void> {
  const card = qualityCardTarget.value
  if (!card) return
  qualityBusy.value = true
  try {
    const updated = await api.rateLearningCardQuality({
      cardId: card.id,
      status: qualityStatus.value,
      reasons: [...qualityReasons.value],
      note: qualityNote.value
    })
    qualityCardTarget.value = null
    if (cardBlockedFromReview(updated)) {
      feedback.value = 'Karte pausiert, bis sie überarbeitet ist.'
      removeCardById(updated.id)
    } else {
      replaceSessionCard(updated)
      feedback.value = 'Kartenqualität gespeichert.'
    }
  } finally {
    qualityBusy.value = false
  }
}

async function startVoiceReview(): Promise<void> {
  const card = currentCard.value
  if (!card || voiceInProgress.value) return
  clearVoiceReview()
  const requestGeneration = ++voiceRequestGeneration
  const abortController = new AbortController()
  voiceAbortController = abortController
  voiceStatus.value = 'connecting'

  try {
    const session = await api.createVoiceReviewSession({ promptId: card.id })
    if (!isCurrentVoiceRequest(requestGeneration)) return
    voiceSessionId.value = session.sessionId
    const client = await startVoiceClient({
      clientSecret: session.clientSecret,
      questionText: card.frontMarkdown,
      introduce: !wolpiIntroduced.value,
      firstName: profileFirstName.value,
      signal: abortController.signal,
      callbacks: {
        onStatus: (status) => {
          if (!isCurrentVoiceRequest(requestGeneration)) return
          voiceStatus.value = status
        },
        onTranscript: (transcript) => {
          if (!isCurrentVoiceRequest(requestGeneration)) return
          voiceTranscript.value = transcript
        },
        onAssessment: (assessment) => {
          if (!isCurrentVoiceRequest(requestGeneration)) return
          voiceAssessment.value = assessment
        },
        onError: (message) => {
          if (!isCurrentVoiceRequest(requestGeneration)) return
          voiceError.value = message
          voiceStatus.value = 'error'
        },
        onCommand: (command) => {
          if (!isCurrentVoiceRequest(requestGeneration)) return
          void handleVoiceCommand(command)
        }
      }
    })
    if (!isCurrentVoiceRequest(requestGeneration)) {
      client.stop()
      return
    }
    wolpiIntroduced.value = true
    voiceClient.value = client
  } catch {
    if (!isCurrentVoiceRequest(requestGeneration)) return
    if (voiceAbortController === abortController) voiceAbortController = null
    voiceStatus.value = 'error'
    voiceError.value ||= 'Das Gespräch konnte nicht gestartet werden. Du kannst die Karte manuell wiederholen.'
  }
}

async function finishVoiceReview(): Promise<void> {
  const sessionId = voiceSessionId.value
  const completionGeneration = voiceRequestGeneration
  stopVoiceClient()
  if (!sessionId || !voiceTranscript.value.trim() || voiceAssessment.value === null) {
    voiceStatus.value = 'uncertain'
    voiceError.value = 'Deine Antwort konnte noch nicht bewertet werden. Du kannst die Karte manuell wiederholen.'
    return
  }

  voiceStatus.value = 'assessing'
  voiceError.value = ''
  try {
    const result = await api.completeVoiceReviewSession({
      sessionId,
      transcript: voiceTranscript.value,
      assessment: voiceAssessment.value
    })
    if (!isCurrentVoiceRequest(completionGeneration)) return
    voiceResult.value = result
    voiceStatus.value = result.recorded ? 'result' : 'uncertain'
  } catch {
    if (!isCurrentVoiceRequest(completionGeneration)) return
    voiceStatus.value = 'uncertain'
    voiceError.value = 'Deine Antwort konnte nicht bewertet werden. Du kannst die Karte manuell wiederholen.'
  }
}

async function handleVoiceCommand(command: VoiceCommand): Promise<void> {
  if (command === 'next_card') {
    nextCard()
  } else if (command === 'previous_card') {
    if (!canGoPrevious.value) {
      clearVoiceReview()
      voiceStatus.value = 'uncertain'
      voiceError.value = 'Das ist schon die erste Karte.'
      return
    }
    moveToPreviousCard(true)
  } else if (command === 'end_session') {
    stopVoiceClient()
    voiceStatus.value = 'uncertain'
    voiceError.value = 'Sprachrunde beendet. Du kannst manuell weitermachen.'
    return
  }

  if (!currentCard.value || sessionCompleted.value || !voiceEnabled.value) return
  await nextTick()
  void startVoiceReview()
}

function stopVoiceClient(): void {
  voiceAbortController?.abort()
  voiceAbortController = null
  voiceClient.value?.stop()
  voiceClient.value = null
}

function clearVoiceReview(): void {
  voiceRequestGeneration += 1
  stopVoiceClient()
  voiceStatus.value = 'idle'
  voiceTranscript.value = ''
  voiceResult.value = null
  voiceError.value = ''
  voiceSessionId.value = null
  voiceAssessment.value = null
}

function isCurrentVoiceRequest(requestGeneration: number): boolean {
  return requestGeneration === voiceRequestGeneration
}

async function restartPractice(): Promise<void> {
  await load()
}

async function rate(rating: ReviewRating): Promise<void> {
  const card = currentCard.value
  if (!card || ratingBusy.value || voiceInProgress.value) return
  ratingBusy.value = true
  try {
    const result = await api.recordReview({ cardId: card.id, rating })
    feedback.value = result.intervalLabel
    if (rating === 1) againQueue.value.push(card)
    registerReviewedCard()
    window.setTimeout(nextCard, 550)
  } catch (error) {
    ratingBusy.value = false
    throw error
  }
}

function registerReviewedCard(): void {
  reviewedCardsInSession.value += 1
  if (reviewedCardsInSession.value % 10 !== 0) return
  showWolpiMilestone(reviewedCardsInSession.value)
}

function showWolpiMilestone(reviewedCount: number): void {
  clearWolpiMilestoneTimer()
  const milestoneIndex = Math.floor(reviewedCount / 10) - 1
  const imageNumber = (milestoneIndex % WOLPI_MILESTONE_IMAGE_COUNT) + 1
  wolpiMilestone.value = {
    kicker: `${reviewedCount} Karten`,
    title: 'Starker Lauf',
    copy: WOLPI_MILESTONE_COPY[milestoneIndex % WOLPI_MILESTONE_COPY.length],
    imageUrl: `assets/wolpi/wolpi-${String(imageNumber).padStart(2, '0')}.webp`
  }
  wolpiMilestoneTimer = window.setTimeout(dismissWolpiMilestone, 3600)
}

function dismissWolpiMilestone(): void {
  clearWolpiMilestoneTimer()
  wolpiMilestone.value = null
}

function clearWolpiMilestoneTimer(): void {
  if (wolpiMilestoneTimer === null) return
  window.clearTimeout(wolpiMilestoneTimer)
  wolpiMilestoneTimer = null
}

function nextCard(): void {
  clearVoiceReview()
  ratingBusy.value = false
  feedback.value = ''
  cardMotion.value = 'next'
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
  moveToPreviousCard(false)
}

function moveToPreviousCard(allowDuringVoice: boolean): void {
  if (!canGoPrevious.value || ratingBusy.value || (!allowDuringVoice && voiceInProgress.value)) return
  clearVoiceReview()
  cardMotion.value = 'previous'
  currentIndex.value -= 1
  feedback.value = ''
  showBack.value = false
}

function skipCard(): void {
  if (!currentCard.value || ratingBusy.value || voiceInProgress.value) return
  nextCard()
}

function removeFromSession(): void {
  if (voiceInProgress.value) return
  clearVoiceReview()
  cardMotion.value = 'next'
  removeCardAtCurrentIndex()
}

function removeCardAtCurrentIndex(): void {
  cards.value.splice(currentIndex.value, 1)
  if (currentIndex.value >= cards.value.length && currentIndex.value > 0) currentIndex.value -= 1
  showBack.value = false
}

function removeCardById(cardId: string): void {
  clearVoiceReview()
  const index = cards.value.findIndex((card) => card.id === cardId)
  if (index >= 0) {
    cards.value.splice(index, 1)
    if (currentIndex.value >= cards.value.length && currentIndex.value > 0) currentIndex.value -= 1
  }
  againQueue.value = againQueue.value.filter((card) => card.id !== cardId)
  showBack.value = false
  if (!cards.value.length && !againQueue.value.length) sessionCompleted.value = true
}

function replaceSessionCard(card: LearningCard): void {
  const replace = (candidate: ReviewCard) => candidate.id === card.id ? { ...candidate, ...card } : candidate
  cards.value = cards.value.map(replace)
  againQueue.value = againQueue.value.map(replace)
}

function cardBlockedFromReview(card: Pick<LearningCard, 'qualityStatus'>): boolean {
  return card.qualityStatus === 'needs_work' || card.qualityStatus === 'problematic'
}

function revealBack(): void {
  if (voiceInProgress.value) return
  cardMotion.value = 'flip'
  showBack.value = true
}

function handleReviewKeydown(event: KeyboardEvent): void {
  if (event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) return
  if (!currentCard.value || loading.value || sessionCompleted.value) return
  if (voiceInProgress.value) return

  if (event.key === 'Enter' && !showBack.value) {
    event.preventDefault()
    revealBack()
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
