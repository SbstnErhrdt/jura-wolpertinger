<template>
  <section class="flashcard-review">
    <header class="review-header">
      <div>
        <AppBreadcrumb :items="breadcrumbItems" />
        <p class="eyebrow">{{ modeLabel }}</p>
        <h1>{{ collectionName || 'Karteikarten' }}</h1>
      </div>
      <UButton v-if="run && !paused && !sessionCompleted" color="neutral" variant="outline" :disabled="ratingBusy" @click="pausePractice">Pause machen</UButton>
      <UButton v-else color="neutral" variant="outline" :to="collectionLink">Zur Sammlung</UButton>
    </header>

    <AppLoadingState v-if="loading" label="Lerneinheit wird geladen">
      <UCard class="empty-state"><USkeleton class="h-6 w-1/3" /><USkeleton class="mt-4 h-24 w-full" /></UCard>
    </AppLoadingState>
    <UAlert v-if="studyError" color="error" title="Der Durchgang konnte nicht aktualisiert werden" :description="studyError" role="alert">
      <template #actions><UButton :loading="ratingBusy" @click="retryStudy">Erneut versuchen</UButton></template>
    </UAlert>
    <div v-if="!loading && paused" class="empty-state study-summary">
      <h2>Für heute pausiert</h2>
      <p>{{ sessionRatings.length }} Karten in dieser Lerneinheit bewertet.</p>
      <p>{{ sessionCounts[3] }} gewusst · {{ sessionCounts[2] }} teilweise gewusst · {{ sessionCounts[1] }} nicht gewusst</p>
      <p v-if="run">{{ run.completed }} von {{ run.total }} bearbeitet · {{ run.remaining }} noch offen</p>
      <div class="empty-actions"><UButton :disabled="ratingBusy || Boolean(pendingStudy)" @click="resumePractice">Weiterlernen</UButton><UButton color="neutral" variant="outline" :to="collectionLink">Zur Sammlung</UButton></div>
    </div>
    <div v-else-if="!loading && sessionCompleted" class="empty-state study-summary">
      <StudyCelebration :celebration="completionCelebration" complete />
      <h2>{{ run?.mode === 'first_pass' ? 'Sammlung einmal vollständig bearbeitet' : 'Durchgang abgeschlossen' }}</h2>
      <p>{{ run?.completed }} von {{ run?.total }} Karten in diesem Durchgang bearbeitet.</p>
      <p v-if="completionOverview">{{ completionOverview.weakCards }} Karten der Sammlung zuletzt nicht oder nur teilweise gewusst.</p>
      <p v-if="run?.excluded">{{ run.excluded }} Karten sind nicht mehr zum Lernen verfügbar und wurden ausgelassen.</p>
      <p v-if="run?.added">{{ run.added }} weitere Karten sind außerhalb dieses Durchgangs verfügbar.</p>
      <div class="empty-actions">
        <UButton v-if="run?.added" :disabled="ratingBusy" @click="restartPractice('first_pass')">Weitere Karten bearbeiten</UButton>
        <UButton v-if="completionOverview?.weakCards" :disabled="ratingBusy || Boolean(pendingStudy)" @click="restartPractice('weak')">Unsichere Karten wiederholen</UButton>
        <UButton color="neutral" variant="outline" :disabled="ratingBusy" @click="restartPractice('all')">Sammlung erneut durcharbeiten</UButton>
        <UButton color="neutral" variant="outline" :to="collectionLink">Zur Sammlung</UButton>
      </div>
    </div>
    <div v-else-if="!loading && !currentCard && !studyError" class="empty-state">
      <h2>{{ run?.deferred ? `${run.deferred} ${run.deferred === 1 ? 'Karte' : 'Karten'} noch offen` : run?.mode === 'review' ? 'Aktuell keine Wiederholung empfohlen' : run?.mode === 'weak' ? 'Keine unsicheren Karten' : 'Keine passenden Karten' }}</h2>
      <p>{{ run?.deferred ? 'Diese Karten hast du für später zurückgestellt.' : 'Für diese Auswahl stehen gerade keine Karten bereit.' }}</p>
      <UButton v-if="run?.deferred" :disabled="ratingBusy" @click="resumeDeferred">Offene Karten bearbeiten</UButton>
      <UButton color="neutral" variant="outline" :to="collectionLink">Zur Sammlung</UButton>
      <StudyCelebration :celebration="milestoneCelebration" @dismiss="milestoneCelebration = null" />
    </div>

    <article v-else-if="!loading && currentCard && !paused" class="study-card study-traversal">
      <div class="study-card-toolbar">
        <div>
          <span class="study-card-kicker">{{ modeLabel }}</span>
          <strong>{{ positionLabel }}</strong>
        </div>
        <UDropdownMenu :items="reviewActions">
          <UButton color="neutral" variant="ghost" icon="i-lucide-ellipsis" aria-label="Kartenaktionen" :disabled="voiceInProgress || ratingBusy || Boolean(pendingStudy)" />
        </UDropdownMenu>
      </div>
      <div v-if="run" class="study-progress" role="progressbar" aria-label="Bearbeitete Karten im Durchgang" :aria-valuenow="run.completed" :aria-valuemin="0" :aria-valuemax="run.total || 1"><span :style="{ width: `${run.total ? run.completed / run.total * 100 : 0}%` }" /></div>
      <p v-if="run?.added" class="study-extra">{{ run.added }} weitere Karten sind nach diesem Durchgang verfügbar.</p>
      <section :key="currentCard.id" class="study-question" aria-label="Frage">
        <p class="study-card-kicker">Frage</p>
        <MarkdownBlock :markdown="currentCard.frontMarkdown" />
      </section>
      <section v-if="showBack" class="study-answer" aria-label="Antwort">
        <p class="study-card-kicker">Antwort</p>
        <MarkdownBlock :markdown="currentCard.backMarkdown" />
      </section>
      <div v-if="showBack && currentCard.tags.length" class="study-card-tags" aria-label="Tags">
        <UBadge v-for="tag in currentCard.tags" :key="tag" class="study-tag" variant="soft">{{ tag }}</UBadge>
        <UBadge :class="cardQualityTone(currentCard.qualityStatus)" variant="soft">
          {{ cardQualityLabel(currentCard.qualityStatus) }}
        </UBadge>
      </div>
      <p v-if="feedback" class="review-feedback">{{ feedback }}</p>
      <div class="review-navigation">
        <UButton type="button" color="neutral" variant="ghost" :disabled="ratingBusy || voiceInProgress || Boolean(pendingStudy)" @click="skipCard">
          Für später zurückstellen
        </UButton>
      </div>
      <UButton
        v-if="voiceEnabled"
        type="button"
        icon="i-lucide-mic"
        :disabled="voiceInProgress || ratingBusy || Boolean(pendingStudy)"
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
          <p>Vorschlag: {{ voiceRatingLabel }}. Vergleiche die Lösung und bestätige deine eigene Einschätzung unten.</p>
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
      <p v-if="showBack" class="study-rating-prompt">Wie gut konntest du die Antwort vor dem Aufdecken?</p>
      <div v-if="showBack" class="rating-row study-rating-three">
        <UButton class="rating-option again" color="error" variant="soft" :disabled="ratingBusy || voiceInProgress || Boolean(pendingStudy)" @click="rate(1)">
          <RotateCcw :size="18" aria-hidden="true" />
          <span>Nicht gewusst</span>
          <kbd class="key-hint">1</kbd>
          <small>Wesentliches fehlte</small>
        </UButton>
        <UButton class="rating-option hard" color="warning" variant="soft" :disabled="ratingBusy || voiceInProgress || Boolean(pendingStudy)" @click="rate(2)">
          <TriangleAlert :size="18" aria-hidden="true" />
          <span>Teilweise gewusst</span>
          <kbd class="key-hint">2</kbd>
          <small>Wichtige Punkte fehlten</small>
        </UButton>
        <UButton class="rating-option good" color="success" variant="soft" :disabled="ratingBusy || voiceInProgress || Boolean(pendingStudy)" @click="rate(3)">
          <CircleCheck :size="18" aria-hidden="true" />
          <span>Gewusst</span>
          <kbd class="key-hint">3</kbd>
          <small>Wesentliche Antwort gewusst</small>
        </UButton>
      </div>
      <UButton v-else color="neutral" variant="outline" class="reveal-button" :disabled="voiceInProgress" @click="revealBack">
        Antwort zeigen
        <kbd class="key-hint">Enter</kbd>
      </UButton>
      <StudyCelebration :celebration="milestoneCelebration" @dismiss="milestoneCelebration = null" />
    </article>
    <div v-if="lastReview && !loading" class="study-undo">
      <UButton color="neutral" variant="ghost" :disabled="ratingBusy || voiceInProgress || Boolean(pendingStudy)" @click="previousCard">Bewertung rückgängig machen</UButton>
    </div>

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
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CircleCheck, RotateCcw, Save, TriangleAlert } from 'lucide-vue-next'
import type { FeatureFlags, VoiceSessionCompleteResult } from '@shared/ipc'
import type { LearningCard, LearningCardQualityReason, LearningCardQualityStatus, ReviewCard, ReviewRating } from '@shared/schemas'
import { api } from '../api'
import { createStudySession } from '../ui/studySession'
import { createStudyCelebration, type StudyCelebration as Celebration } from '../ui/studyCelebration'
import StudyCelebration from '../components/StudyCelebration.vue'
import AppLoadingState from '../components/ui/AppLoadingState.vue'
import type { StudyMode, StudyOverview } from '@shared/flashcardStudy'
import MarkdownBlock from '../components/StudyMarkdown.vue'
import TagInput from '../components/TagInput.vue'
import { hasFeatureFlag } from '../voice/featureFlags'
import { startVoiceClient, type VoiceAssessment, type VoiceClient, type VoiceClientStatus, type VoiceCommand } from '../voice/voiceClient'
import type { AppActionMenuItem } from '../ui/actionMenu'
import AppBreadcrumb from '../components/ui/AppBreadcrumb.vue'
import type { AppBreadcrumbItem } from '../ui/breadcrumbs'
import {
  cardQualityLabel,
  cardQualityOptions,
  cardQualityReasonOptions,
  cardQualityTone
} from '../ui/flashcardQuality'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const study = createStudySession((input) => api.studyFlashcards(input))
const { cards, run, error: studyError, pending: pendingStudy, ratings: sessionRatings, lastReview } = study
const celebrations = createStudyCelebration()
const studyUserId = ref<string | null>(null)
const milestoneCelebration = ref<Celebration | null>(null)
const completionCelebration = ref<Celebration | null>(null)
watch(study.applied, (applied) => {
  if (!applied) return
  const userId = studyUserId.value ?? applied.response.review?.event.userId
  if (!userId) return
  const result = celebrations.apply(userId, applied.command, applied.response)
  milestoneCelebration.value = result.milestone
  completionCelebration.value = result.completion
})
const paused = ref(false)
const modeLabel = computed(() => ({ first_pass: 'Erster Durchgang', review: 'Empfohlene Wiederholung', weak: 'Unsichere Karten', all: 'Vollständiger Durchgang' })[run.value?.mode ?? 'first_pass'])
const sessionCounts = computed(() => ({ 1: sessionRatings.value.filter((r) => r.rating === 1).length, 2: sessionRatings.value.filter((r) => r.rating === 2).length, 3: sessionRatings.value.filter((r) => r.rating >= 3).length }))
const collectionLink = computed(() => collectionId.value ? { name: 'flashcards-collection', params: { id: collectionId.value } } : { name: 'flashcards-collections' })
const voiceRatingLabel = computed(() => voiceResult.value?.assessment.confidence === 'low' ? 'noch unsicher' : voiceResult.value?.assessment.rating === 1 ? 'Nicht gewusst' : voiceResult.value?.assessment.rating === 2 ? 'Teilweise gewusst' : 'Gewusst')
const showBack = ref(false)
const feedback = ref('')
const ratingBusy = study.busy
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
const sessionCompleted = computed(() => Boolean(run.value && run.value.total > 0 && run.value.status === 'completed'))
const completionOverview = ref<StudyOverview | null>(null)
watch(() => sessionCompleted.value ? run.value?.id : null, async (id) => {
  completionOverview.value = null
  if (!id || !collectionId.value) return
  const result = await api.studyFlashcards({ action: 'overview', collectionId: collectionId.value }).catch(() => null)
  if (run.value?.id === id) completionOverview.value = result?.overviews[0] ?? null
})
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
let voiceRequestGeneration = 0
let voiceAbortController: AbortController | null = null

const currentCard = computed(() => cards.value[0] ?? null)
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
const canGoPrevious = computed(() => Boolean(lastReview.value))
const positionLabel = computed(() => run.value ? `${run.value.completed} von ${run.value.total} ${run.value.mode === 'first_pass' ? 'einmal ' : ''}bearbeitet` : '')
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
  items.push({ label: 'Lernen' })
  return items
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
    label: 'Für später zurückstellen',
    icon: 'i-lucide-clock',
    onSelect: removeFromSession
  }
])

onMounted(() => {
  window.addEventListener('keydown', handleReviewKeydown)
  void load()
})

onUnmounted(() => {
  studyLoadGeneration += 1
  window.removeEventListener('keydown', handleReviewKeydown)
  voiceRequestGeneration += 1
  stopVoiceClient()
})

let studyLoadGeneration = 0

async function load(): Promise<void> {
  const generation = ++studyLoadGeneration
  const requestedFullPath = route.fullPath
  const requestedCollectionId = collectionId.value
  const requestedRunId = typeof route.query.run === 'string' ? route.query.run : null
  const mode = ['review', 'weak', 'all'].includes(String(route.query.mode)) ? route.query.mode as StudyMode : 'first_pass'
  const isCurrentStudy = () => generation === studyLoadGeneration && route.fullPath === requestedFullPath
  loading.value = true
  milestoneCelebration.value = null
  completionCelebration.value = null
  studyUserId.value = null
  clearVoiceReview()
  wolpiIntroduced.value = false
  if (!requestedCollectionId) {
    await router.replace({ name: 'flashcards-collections' })
    loading.value = false
    return
  }
  try {
  const [nextFeatureFlags, nextProfile, nextUser] = await Promise.all([
    api.getFeatureFlags().catch(() => ({})),
    api.getUserProfile().catch(() => null),
    api.getCurrentUser().catch(() => null)
  ])
  if (!isCurrentStudy()) return
  featureFlags.value = nextFeatureFlags
  profileFirstName.value = nextProfile?.firstName ?? null
  studyUserId.value = nextUser?.id ?? nextProfile?.userId ?? null
  const collections = await api.listLearningCollections()
  if (!isCurrentStudy()) return
  collectionName.value = collections.find((collection) => collection.id === requestedCollectionId)?.name ?? ''
  if (requestedRunId) await study.send({ action: 'batch', runId: requestedRunId })
  else await study.send({ action: 'start', collectionId: requestedCollectionId, mode })
  if (!isCurrentStudy()) return
  if (!pendingStudy.value && run.value?.remaining && run.value.remaining === run.value.deferred) await study.send({ action: 'resume_deferred', runId: run.value.id })
  if (!isCurrentStudy()) return
  if (run.value) await router.replace({ name: 'flashcards-review', query: { collection: requestedCollectionId, run: run.value.id, mode: run.value.mode } })
  showBack.value = false
  } catch {
    studyError.value = 'Die Sammlung konnte nicht geladen werden. Bitte öffne sie erneut.'
  } finally {
    loading.value = false
  }
}

function openEditCardDialog(card: ReviewCard): void {
  milestoneCelebration.value = null
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
    showCardDialog.value = false
    editingCard.value = null
  } catch {
    feedback.value = 'Die Änderungen konnten nicht gespeichert werden. Bitte versuche es erneut.'
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
      await removeCardById(updated.id)
    } else {
      replaceSessionCard(updated)
      feedback.value = 'Kartenqualität gespeichert.'
    }
  } catch {
    feedback.value = 'Die Kartenqualität konnte nicht gespeichert werden. Bitte versuche es erneut.'
  } finally {
    qualityBusy.value = false
  }
}

async function startVoiceReview(): Promise<void> {
  milestoneCelebration.value = null
  const card = currentCard.value
  if (!card || voiceInProgress.value || ratingBusy.value || pendingStudy.value) return
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
      assessment: { ...voiceAssessment.value, record_review: false }
    })
    if (!isCurrentVoiceRequest(completionGeneration)) return
    voiceResult.value = result
    voiceStatus.value = 'result'
    showBack.value = true
  } catch {
    if (!isCurrentVoiceRequest(completionGeneration)) return
    voiceStatus.value = 'uncertain'
    voiceError.value = 'Deine Antwort konnte nicht bewertet werden. Du kannst die Karte manuell wiederholen.'
  }
}

async function handleVoiceCommand(command: VoiceCommand): Promise<void> {
  if (command === 'next_card') {
    stopVoiceClient()
    voiceStatus.value = 'idle'
    await skipCard()
  } else if (command === 'previous_card') {
    if (!canGoPrevious.value) {
      clearVoiceReview()
      voiceStatus.value = 'uncertain'
      voiceError.value = 'Das ist schon die erste Karte.'
      return
    }
    stopVoiceClient()
    voiceStatus.value = 'uncertain'
    voiceError.value = 'Du kannst die letzte Bewertung über „Bewertung rückgängig machen“ korrigieren.'
    return
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

async function restartPractice(mode: StudyMode = 'all'): Promise<void> {
  if (!collectionId.value || ratingBusy.value || pendingStudy.value) return
  if (await study.send({ action: 'start', collectionId: collectionId.value, mode })) {
    paused.value = false
    showBack.value = false
    clearVoiceReview()
    if (run.value) await router.replace({ name: 'flashcards-review', query: { collection: collectionId.value, run: run.value.id, mode } })
  }
}

async function rate(rating: ReviewRating): Promise<void> {
  const card = currentCard.value
  if (!card || !run.value || !showBack.value || paused.value || ratingBusy.value || voiceInProgress.value || pendingStudy.value) return
  if (await study.send({ action: 'rate', runId: run.value.id, cardId: card.id, rating, eventId: crypto.randomUUID() })) {
    showBack.value = false
    clearVoiceReview()
    feedback.value = ''
  }
}

async function retryStudy(): Promise<void> {
  if (!pendingStudy.value) { await load(); return }
  const action = pendingStudy.value.action
  if (await study.retry()) { showBack.value = action === 'undo'; clearVoiceReview() }
}

function pausePractice(): void {
  milestoneCelebration.value = null
  clearVoiceReview()
  paused.value = true
}

async function resumePractice(): Promise<void> {
  if (pendingStudy.value) return
  const previousId = currentCard.value?.id
  if (run.value && await study.send({ action: 'batch', runId: run.value.id })) {
    if (currentCard.value?.id !== previousId) showBack.value = false
    paused.value = false
  }
}

async function resumeDeferred(): Promise<void> {
  if (pendingStudy.value) return
  if (run.value) await study.send({ action: 'resume_deferred', runId: run.value.id })
}

async function nextCard(): Promise<void> {
  if (run.value) await study.send({ action: 'batch', runId: run.value.id })
}

async function previousCard(): Promise<void> {
  if (!run.value || !lastReview.value || ratingBusy.value || voiceInProgress.value || pendingStudy.value) return
  clearVoiceReview()
  if (await study.send({ action: 'undo', runId: run.value.id, eventId: lastReview.value.eventId })) {
    showBack.value = true
    paused.value = false
  }
}

async function skipCard(): Promise<void> {
  if (!currentCard.value || !run.value || ratingBusy.value || voiceInProgress.value || pendingStudy.value) return
  const cardId = currentCard.value.id
  if (await study.send({ action: 'defer', runId: run.value.id, cardId })) {
    clearVoiceReview()
    showBack.value = false
    feedback.value = 'Für später zurückgestellt. Die Karte bleibt offen.'
  }
}

function removeFromSession(): void {
  if (voiceInProgress.value) return
  clearVoiceReview()
  void skipCard()
}

async function removeCardById(cardId: string): Promise<void> {
  clearVoiceReview()
  cards.value = cards.value.filter((card) => card.id !== cardId)
  showBack.value = false
  await nextCard()
}

function replaceSessionCard(card: LearningCard): void {
  const replace = (candidate: ReviewCard) => candidate.id === card.id ? { ...candidate, ...card } : candidate
  cards.value = cards.value.map(replace)
}

function cardBlockedFromReview(card: Pick<LearningCard, 'qualityStatus'>): boolean {
  return card.qualityStatus === 'needs_work' || card.qualityStatus === 'problematic'
}

function revealBack(): void {
  if (voiceInProgress.value) return
  milestoneCelebration.value = null
  showBack.value = true
}

function handleReviewKeydown(event: KeyboardEvent): void {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target) || showCardDialog.value || qualityCardTarget.value || paused.value || pendingStudy.value) return
  if (!currentCard.value || loading.value || sessionCompleted.value) return
  if (voiceInProgress.value) return

  if (['Enter', ' '].includes(event.key) && !showBack.value) {
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

  if (showBack.value && ['1', '2', '3'].includes(event.key)) {
    event.preventDefault()
    void rate(Number(event.key) as ReviewRating)
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return Boolean(target.closest('input, textarea, select, button, a, [role="button"], [role="menuitem"], [role="combobox"]'))
}

</script>

<style scoped>
.flashcard-review { min-width: 0; grid-template-columns: minmax(0, 1fr); }
.review-header > div { min-width: 0; max-width: 100%; }
.study-traversal { width: 100%; max-width: 900px; min-height: 0; margin-inline: auto; }
.study-progress { height: 5px; overflow: hidden; border-radius: 3px; background: var(--ui-bg-accented); }
.study-progress > span { display: block; height: 100%; background: var(--ui-primary); }
.study-question, .study-answer { padding: .75rem 0; }
.study-question { min-height: 150px; }
.study-answer { border-top: 1px solid var(--ui-border); }
.study-extra { font-size: .875rem; color: var(--ui-text-muted); }
.study-rating-prompt { margin-block: 1rem .5rem; font-weight: 600; }
.study-rating-three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.study-card-tags .study-tag { color: #164d6a; background: #e9f2f8; }
:global(:root[data-theme='dark'] .study-card-tags .study-tag) { color: #b7ddf4; background: #17384a; }
.study-rating-three .again { color: #9f241c; background: #fff1f0; }
.study-rating-three .hard { color: #854000; background: #fff6df; }
.study-rating-three .good { color: #12633b; background: #eaf8f0; }
.study-rating-three .rating-option small { color: inherit; opacity: 1; }
:global(:root[data-theme='dark'] .study-rating-three .rating-option.again) { color: #ffb4ad; background: #452321; }
:global(:root[data-theme='dark'] .study-rating-three .rating-option.hard) { color: #ffdc99; background: #40331b; }
:global(:root[data-theme='dark'] .study-rating-three .rating-option.good) { color: #a0e8bd; background: #1a3a2a; }
.study-undo { text-align: center; margin-block: 1rem; }
.study-summary p { margin-block: .75rem; }
@media (max-width: 600px) { .study-rating-three { grid-template-columns: 1fr; } }
</style>
