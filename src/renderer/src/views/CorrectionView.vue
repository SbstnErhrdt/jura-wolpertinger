<template>
  <section class="correction-view">
    <aside class="correction-list-panel">
      <div class="correction-list-header">
        <AppBreadcrumb :items="listBreadcrumbItems" />
        <p class="eyebrow">Bewertung</p>
        <h1>Abgaben</h1>
      </div>
      <div v-if="submittedItems.length" class="correction-submission-list">
        <RouterLink
          v-for="item in submittedItems"
          :key="item.submissionId"
          class="correction-submission-item"
          :class="{ active: item.submissionId === submission?.id, graded: item.scorePoints !== null }"
          :to="{ name: 'correction', params: { id: item.submissionId } }"
        >
          <div class="correction-submission-title">
            <strong>{{ item.examTitle }}</strong>
            <CheckCircle2 v-if="item.scorePoints !== null" :size="17" aria-hidden="true" />
          </div>
          <span>{{ formatDate(item.submittedAt) }}</span>
          <div class="correction-submission-status" :class="{ done: item.scorePoints !== null }">
            <CheckCircle2 v-if="item.scorePoints !== null" :size="14" aria-hidden="true" />
            <Clock3 v-else :size="14" aria-hidden="true" />
            <span>{{ item.scorePoints === null ? waitingLabel(item.submittedAt) : 'Bewertet' }}</span>
          </div>
          <div class="correction-submission-meta">
            <em>{{ item.scorePoints === null ? 'Offen' : `${formatScoreInput(item.scorePoints)} Punkte` }}</em>
            <small>{{ item.commentCount }} {{ item.commentCount === 1 ? 'Kommentar' : 'Kommentare' }}</small>
          </div>
        </RouterLink>
      </div>
      <p v-else class="empty-state">Keine abgegebenen Prüfungen.</p>
    </aside>

    <div class="correction-detail-scroll">
      <template v-if="submission && correction">
        <header class="page-header correction-detail-header">
          <div>
            <AppBreadcrumb :items="detailBreadcrumbItems" />
            <p class="eyebrow">Korrektur · {{ formatDate(submission.submittedAt) }}</p>
            <h1>{{ submission.examTitle }}</h1>
          </div>
          <div class="header-actions">
            <RouterLink class="secondary" :to="{ name: 'exam', params: { id: submission.examId } }">
              Zur Prüfung
            </RouterLink>
            <button type="button" class="secondary" @click="showAiSettings = !showAiSettings">
              KI einrichten
            </button>
            <button type="button" :disabled="aiBusy || !aiSettings.configured || cloudAiDisabled" @click="generateAiDraft">
              {{ cloudAiDisabled ? 'Cloud-KI noch nicht freigeschaltet' : aiBusy ? 'KI arbeitet...' : 'KI-Korrektur vorschlagen' }}
            </button>
            <button :disabled="aiBusy" @click="saveCorrection">Speichern</button>
          </div>
        </header>

        <p v-if="actionError" class="action-error">{{ actionError }}</p>
        <p v-if="aiNotice" class="action-notice">{{ aiNotice }}</p>

        <div class="correction-workspace">
          <section v-if="showAiSettings" class="correction-assessment-panel ai-settings-panel">
            <div>
              <h2>KI-Korrektur</h2>
              <p class="field-hint">
                Aufgabenstellung, Musterlösung und Abgabe werden für die Korrektur an den
                konfigurierten KI-Anbieter übertragen.
              </p>
              <div class="settings-ai-status compact">
                <strong>{{ aiStatusTitle }}</strong>
                <p>{{ aiStatusDescription }}</p>
                <span v-if="aiKeyPreview">Key: {{ aiKeyPreview }}</span>
                <span>Modell: {{ aiSettings.model ?? DEFAULT_AI_MODEL }}</span>
                <span v-if="storedKeyOverridesEnvironment" class="settings-ai-hint">
                  Gespeicherter App-Key überschreibt deinen .env-Key.
                </span>
                <span v-if="aiConnectionMessage" :class="aiConnectionOk ? 'settings-test-ok' : 'settings-test-error'">
                  {{ aiConnectionMessage }}
                </span>
              </div>
              <div v-if="!showAiKeyForm" class="dialog-actions">
                <button type="button" @click="openAiKeyForm">{{ aiSetupButtonLabel }}</button>
                <button
                  type="button"
                  class="secondary"
                  :disabled="!aiSettings.configured || aiBusy"
                  @click="testAiConnection"
                >
                  {{ aiBusy ? 'Prüft ...' : 'Verbindung testen' }}
                </button>
                <button
                  v-if="storedKeyOverridesEnvironment"
                  type="button"
                  class="secondary"
                  :disabled="aiBusy"
                  @click="testEnvironmentConnection"
                >
                  .env-Key testen
                </button>
                <button
                  v-if="effectiveAiSource === 'stored'"
                  type="button"
                  class="secondary danger-secondary"
                  :disabled="aiBusy"
                  @click="startRemoveAiSettings"
                >
                  App-Key entfernen
                </button>
              </div>
              <div v-if="confirmRemoveAiKey" class="settings-confirm-remove">
                <strong>App-Key entfernen?</strong>
                <p>KI-Korrekturen nutzen danach keinen gespeicherten App-Key mehr.</p>
                <div class="dialog-actions">
                  <button type="button" class="danger-button" :disabled="aiBusy" @click="removeAiSettings">
                    Entfernen
                  </button>
                  <button type="button" class="secondary" :disabled="aiBusy" @click="cancelRemoveAiSettings">
                    Abbrechen
                  </button>
                </div>
              </div>
              <form v-if="showAiKeyForm" class="settings-key-form" @submit.prevent="saveAiSettings">
                <label>
                  OpenAI API-Key
                  <input v-model="aiApiKeyInput" type="password" :placeholder="aiKeyPlaceholder" />
                  <span v-if="effectiveAiSource === 'stored'" class="settings-field-note">
                    Der gespeicherte Key bleibt erhalten, wenn du hier nichts eingibst.
                  </span>
                </label>
                <label>
                  Modell
                  <input v-model="aiModelInput" :placeholder="DEFAULT_AI_MODEL" />
                </label>
                <div class="dialog-actions">
                  <button type="submit" :disabled="aiBusy">
                    {{ aiBusy ? 'Speichert ...' : 'Speichern' }}
                  </button>
                  <button type="button" class="secondary" :disabled="aiBusy" @click="cancelAiKeyForm">
                    Abbrechen
                  </button>
                </div>
              </form>
            </div>
          </section>

          <section class="correction-assessment-panel">
            <div>
              <h2>Bewertung</h2>
              <div class="correction-score-grid">
                <label>
                  Punkte
                  <input
                    v-model="scoreInput"
                    inputmode="decimal"
                    placeholder="0 bis 18, z. B. 12,5"
                    @blur="normalizeScoreInput"
                  />
                </label>
                <p class="field-hint">Erlaubt sind Werte von 0 bis 18 in 0,5er-Schritten.</p>
              </div>
              <label>
                Bewertungskommentar
                <textarea v-model="gradingComment" rows="4" />
              </label>
            </div>
          </section>

          <section v-if="selectedAiDraft" class="correction-assessment-panel ai-draft-panel">
            <div>
              <h2>KI-Vorschlag</h2>
              <div class="ai-draft-score">
                <strong>{{ formatScoreInput(selectedAiDraft.score.points) || 'ohne Punkte' }}</strong>
                <span v-if="selectedAiDraft.score.points !== null">Punkte</span>
              </div>
              <p class="field-hint">{{ selectedAiDraft.scoreReasoning }}</p>

              <div class="ai-draft-section">
                <h3>Bewertungskommentar</h3>
                <p>{{ selectedAiDraft.gradingComment }}</p>
              </div>

              <div
                v-if="selectedAiDraft.strengths.length || selectedAiDraft.weaknesses.length"
                class="ai-draft-two-column"
              >
                <div v-if="selectedAiDraft.strengths.length">
                  <h3>Stärken</h3>
                  <ul>
                    <li v-for="strength in selectedAiDraft.strengths" :key="strength">
                      {{ strength }}
                    </li>
                  </ul>
                </div>
                <div v-if="selectedAiDraft.weaknesses.length">
                  <h3>Schwächen</h3>
                  <ul>
                    <li v-for="weakness in selectedAiDraft.weaknesses" :key="weakness">
                      {{ weakness }}
                    </li>
                  </ul>
                </div>
              </div>

              <div v-if="selectedAiDraft.improvementSuggestions.length" class="ai-draft-section">
                <h3>Verbesserungsvorschläge</h3>
                <ul class="ai-suggestion-list">
                  <li
                    v-for="suggestion in selectedAiDraft.improvementSuggestions"
                    :key="`${suggestion.category}-${suggestion.priority}-${suggestion.title}`"
                  >
                    <div>
                      <strong>{{ suggestion.title }}</strong>
                      <span>
                        {{ formatImprovementCategory(suggestion.category) }} ·
                        {{ formatLearningTaskPriority(suggestion.priority) }}
                      </span>
                    </div>
                    <p>{{ suggestion.detail }}</p>
                  </li>
                </ul>
              </div>

              <div v-if="selectedAiDraft.inlineComments.length" class="ai-draft-section">
                <h3>Inline-Kommentare</h3>
                <ul class="ai-inline-comment-list">
                  <li
                    v-for="comment in selectedAiDraft.inlineComments"
                    :key="`${comment.selectedText}-${comment.body}`"
                  >
                    <blockquote>{{ comment.selectedText }}</blockquote>
                    <p>{{ comment.body }}</p>
                  </li>
                </ul>
              </div>

              <div class="dialog-actions">
                <button type="button" class="secondary" :disabled="aiBusy" @click="rejectAiDraft(selectedAiDraft.id)">
                  Verwerfen
                </button>
                <button type="button" :disabled="aiBusy" @click="acceptAiDraft(selectedAiDraft.id)">
                  Übernehmen
                </button>
              </div>
            </div>
          </section>

          <div class="correction-document-grid">
            <main ref="submissionPaperRef" class="submission-paper">
              <div
                ref="paperRef"
                class="readonly-document"
                tabindex="0"
                @mouseup="captureSelection"
                @keyup="captureSelection"
                v-html="renderedHtml"
              />
              <div
                v-if="selectedText"
                class="selection-comment-popover"
                :style="{ left: `${selectionPopover.x}px`, top: `${selectionPopover.y}px` }"
                @mousedown.stop
                @click.stop
              >
                <div class="selection-preview">
                  <span>Ausgewählter Text</span>
                  <p>{{ selectedText }}</p>
                </div>
                <label class="comment-input-label">
                  Kommentar
                  <textarea
                    v-model="commentBody"
                    rows="3"
                    placeholder="Hinweis oder Korrektur zur markierten Passage"
                    autofocus
                  />
                </label>
                <div class="comment-actions">
                  <button type="button" class="secondary" @click="clearSelectedText">
                    Abbrechen
                  </button>
                  <button type="button" :disabled="!canAddComment" @click="addComment">
                    Kommentar setzen
                  </button>
                </div>
              </div>
            </main>
            <aside class="document-comment-rail" :style="{ minHeight: `${commentRailHeight}px` }">
              <article
                v-for="(comment, index) in correction.inlineComments"
                :key="comment.id"
                class="comment-card margin-comment-card"
                :class="{ active: activeCommentId === comment.id }"
                :style="{ top: `${commentTop(comment, index)}px`, zIndex: activeCommentId === comment.id ? 30 : 1 }"
                @mouseenter="highlightInlineComment(comment)"
                @mouseleave="clearInlineCommentHighlight"
              >
                <blockquote>{{ comment.anchor.selectedText || 'Auswahl' }}</blockquote>
                <p>{{ comment.body }}</p>
                <span>{{ formatDate(comment.createdAt) }}</span>
              </article>
              <p v-if="!correction.inlineComments.length" class="empty-state margin-empty-state">
                Kommentare erscheinen hier neben der markierten Stelle.
              </p>
              <div v-if="!selectedText" class="rail-comment-hint">
                <strong>Keine Auswahl</strong>
                <p>Markiere eine Passage im Dokument.</p>
              </div>
            </aside>
          </div>
        </div>
      </template>
      <div v-else class="correction-empty-detail">
        <div class="correction-start-panel">
          <AppBreadcrumb :items="listBreadcrumbItems" />
          <p class="eyebrow">Bewertung</p>
          <h2>Abgabe auswählen</h2>
          <p>Wähle links eine abgegebene Prüfung aus, um die Bewertung zu starten.</p>
          <div v-if="submittedItems.length" class="correction-start-stats">
            <div>
              <strong>{{ openSubmissionCount }}</strong>
              <span>offen</span>
            </div>
            <div>
              <strong>{{ gradedSubmissionCount }}</strong>
              <span>bewertet</span>
            </div>
          </div>
          <RouterLink
            v-if="nextOpenSubmission"
            class="correction-start-action"
            :to="{ name: 'correction', params: { id: nextOpenSubmission.submissionId } }"
          >
            Nächste offene Abgabe bewerten
          </RouterLink>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { CheckCircle2, Clock3 } from 'lucide-vue-next'
import { DEFAULT_AI_MODEL, EDITOR_SCHEMA_VERSION } from '@shared/constants'
import { aiConnectionFallbackMessage, type AiConnectionTestSource } from '@shared/aiConnectionFeedback'
import type { AiSettingsStatus, SubmissionDetails } from '@shared/ipc'
import type { AiCorrectionDraft, Correction, InlineComment } from '@shared/schemas'
import { api } from '../api'
import { requiresCloudAuth } from '../cloudAuth'
import AppBreadcrumb, { type BreadcrumbItem } from '../components/ui/AppBreadcrumb.vue'
import { renderTiptapHtml } from '../utils/renderTiptap'

type SubmittedItem = {
  submissionId: string
  examId: string
  examTitle: string
  submittedAt: string
  scorePoints: number | null
  commentCount: number
}

const route = useRoute()
const submission = ref<SubmissionDetails | null>(null)
const correction = ref<Correction | null>(null)
const submittedItems = ref<SubmittedItem[]>([])
const scoreInput = ref('')
const gradingComment = ref('')
const selectedText = ref('')
const commentBody = ref('')
const paperRef = ref<HTMLElement | null>(null)
const submissionPaperRef = ref<HTMLElement | null>(null)
const actionError = ref('')
const activeCommentId = ref<string | null>(null)
const commentPositions = ref<Record<string, number>>({})
const commentRailHeight = ref(760)
const selectionPopover = ref({ x: 0, y: 0 })
const aiSettings = ref<AiSettingsStatus>({
  provider: 'openai',
  configured: false,
  model: null,
  source: null,
  keyPreview: null,
  environmentAvailable: false,
  updatedAt: null
})
const aiDrafts = ref<AiCorrectionDraft[]>([])
const showAiSettings = ref(false)
const showAiKeyForm = ref(false)
const confirmRemoveAiKey = ref(false)
const aiApiKeyInput = ref('')
const aiModelInput = ref(DEFAULT_AI_MODEL)
const aiBusy = ref(false)
const aiNotice = ref('')
const aiConnectionMessage = ref('')
const aiConnectionOk = ref(false)
const cloudAiDisabled = requiresCloudAuth()
const effectiveAiSource = computed(() =>
  aiSettings.value.source ?? (aiSettings.value.configured ? 'stored' : null)
)
const aiKeyPreview = computed(() =>
  aiSettings.value.keyPreview ?? (effectiveAiSource.value === 'stored' ? 'gespeichert' : null)
)

const renderedHtml = computed(() =>
  submission.value ? renderTiptapHtml(submission.value.content) : ''
)
const canAddComment = computed(() => Boolean(!aiBusy.value && selectedText.value && commentBody.value.trim()))
const openSubmissionCount = computed(
  () => submittedItems.value.filter((item) => item.scorePoints === null).length
)
const gradedSubmissionCount = computed(
  () => submittedItems.value.filter((item) => item.scorePoints !== null).length
)
const nextOpenSubmission = computed(
  () => submittedItems.value.find((item) => item.scorePoints === null) ?? submittedItems.value[0] ?? null
)
const listBreadcrumbItems: BreadcrumbItem[] = [
  { label: 'Home', to: { name: 'home' } },
  { label: 'Prüfungen' },
  { label: 'Bewertung' }
]
const detailBreadcrumbItems = computed<BreadcrumbItem[]>(() => [
  { label: 'Home', to: { name: 'home' } },
  { label: 'Prüfungen' },
  { label: 'Bewertung', to: { name: 'correction' } },
  { label: submission.value?.examTitle ?? 'Abgabe' }
])
const selectedAiDraft = computed(
  () => aiDrafts.value.find((draft) => draft.status === 'draft') ?? null
)
const aiKeyPlaceholder = computed(() =>
  effectiveAiSource.value === 'stored' ? 'neuer Key oder leer lassen' : 'sk-...'
)
const storedKeyOverridesEnvironment = computed(
  () => effectiveAiSource.value === 'stored' && Boolean(aiSettings.value.environmentAvailable)
)
const aiStatusTitle = computed(() => {
  if (cloudAiDisabled) return 'Cloud-KI noch nicht freigeschaltet'
  if (effectiveAiSource.value === 'stored') return 'OpenAI-Key gespeichert'
  if (effectiveAiSource.value === 'environment') return 'Entwicklungs-Key aktiv'
  return 'OpenAI-Key fehlt'
})
const aiStatusDescription = computed(() => {
  if (cloudAiDisabled) return 'KI-Korrektur ist in der Cloud-Version sichtbar, aber noch deaktiviert.'
  if (effectiveAiSource.value === 'stored') return 'KI-Korrekturen nutzen den lokal gespeicherten App-Key.'
  if (effectiveAiSource.value === 'environment') return 'Der Key kommt aus deiner lokalen .env-Datei.'
  return 'Richte einen eigenen OpenAI-Key ein, bevor KI-Korrekturen gestartet werden.'
})
const aiSetupButtonLabel = computed(() =>
  effectiveAiSource.value === 'stored'
    ? 'Key oder Modell ändern'
    : effectiveAiSource.value === 'environment'
      ? 'Eigenen App-Key speichern'
      : 'OpenAI-Key einrichten'
)

onMounted(() => {
  window.addEventListener('resize', updateCommentPositions)
  load()
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', updateCommentPositions)
  clearInlineCommentHighlight()
})
watch(
  () => route.params.id,
  () => load()
)

async function load(): Promise<void> {
  await loadSubmittedItems()
  aiSettings.value = await api.getAiSettingsStatus()
  const submissionId = typeof route.params.id === 'string' ? route.params.id : null
  if (!submissionId) {
    submission.value = null
    correction.value = null
    aiDrafts.value = []
    scoreInput.value = ''
    gradingComment.value = ''
    return
  }

  submission.value = await api.getSubmission(submissionId)
  correction.value =
    submission.value.corrections[0] ?? (await api.createCorrection(submission.value.id))
  aiDrafts.value = await api.listAiCorrectionDrafts(submission.value.id)
  scoreInput.value = formatScoreInput(correction.value.score.points)
  gradingComment.value = correction.value.gradingComment
  await nextTick()
  updateCommentPositions()
}

async function loadSubmittedItems(): Promise<void> {
  const exams = await api.listExams()
  const submittedExams = exams.filter((exam) => exam.status !== 'archived')
  const details = await Promise.all(submittedExams.map((exam) => api.getExam(exam.id)))
  const items = details.flatMap((exam) =>
    exam.submissions.map((submission) => ({
        submissionId: submission.id,
        examId: exam.id,
        examTitle: exam.title,
        submittedAt: submission.submittedAt,
        scorePoints: exam.latestScore,
        commentCount: 0
      }))
  )
  const itemDetails = await Promise.all(
    items.map(async (item) => {
      const submissionDetails = await api.getSubmission(item.submissionId)
      const correction = submissionDetails.corrections[0]
      return {
        ...item,
        scorePoints: correction?.score.points ?? null,
        commentCount: submissionDetails.corrections.reduce(
          (sum, correction) => sum + correction.inlineComments.length,
          0
        )
      }
    })
  )
  submittedItems.value = itemDetails
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))
}

async function saveCorrection(): Promise<void> {
  if (!correction.value || aiBusy.value) return
  actionError.value = ''
  aiNotice.value = ''
  try {
    correction.value = await api.updateCorrection({
      correctionId: correction.value.id,
      scorePoints: parseScoreInput(scoreInput.value),
      gradingComment: gradingComment.value,
      tags: []
    })
    scoreInput.value = formatScoreInput(correction.value.score.points)
    await loadSubmittedItems()
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : String(error)
  }
}

async function saveAiSettings(): Promise<void> {
  actionError.value = ''
  aiNotice.value = ''
  aiBusy.value = true
  try {
    aiSettings.value = await api.saveAiSettings({
      provider: 'openai',
      apiKey: aiApiKeyInput.value,
      model: aiModelInput.value.trim() || DEFAULT_AI_MODEL
    })
    aiModelInput.value = aiSettings.value.model ?? DEFAULT_AI_MODEL
    aiApiKeyInput.value = ''
    showAiKeyForm.value = false
    confirmRemoveAiKey.value = false
    aiNotice.value = 'KI-Einstellungen gespeichert.'
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : String(error)
  } finally {
    aiBusy.value = false
  }
}

function openAiKeyForm(): void {
  actionError.value = ''
  aiNotice.value = ''
  aiConnectionMessage.value = ''
  confirmRemoveAiKey.value = false
  aiApiKeyInput.value = ''
  aiModelInput.value = aiSettings.value.model ?? DEFAULT_AI_MODEL
  showAiKeyForm.value = true
}

function cancelAiKeyForm(): void {
  aiApiKeyInput.value = ''
  aiModelInput.value = aiSettings.value.model ?? DEFAULT_AI_MODEL
  showAiKeyForm.value = false
}

function startRemoveAiSettings(): void {
  actionError.value = ''
  aiNotice.value = ''
  aiConnectionMessage.value = ''
  showAiKeyForm.value = false
  confirmRemoveAiKey.value = true
}

function cancelRemoveAiSettings(): void {
  confirmRemoveAiKey.value = false
}

async function removeAiSettings(): Promise<void> {
  actionError.value = ''
  aiNotice.value = ''
  aiConnectionMessage.value = ''
  aiBusy.value = true
  try {
    aiSettings.value = await api.removeAiSettings()
    aiModelInput.value = aiSettings.value.model ?? DEFAULT_AI_MODEL
    aiApiKeyInput.value = ''
    showAiKeyForm.value = false
    confirmRemoveAiKey.value = false
    aiNotice.value =
      effectiveAiSource.value === 'environment'
        ? 'App-Key entfernt. Der Entwicklungs-Key aus .env ist weiter aktiv.'
        : 'OpenAI-Key entfernt.'
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : String(error)
  } finally {
    aiBusy.value = false
  }
}

async function runAiConnectionTest(source: AiConnectionTestSource): Promise<void> {
  actionError.value = ''
  aiNotice.value = ''
  aiConnectionOk.value = false
  aiConnectionMessage.value =
    source === 'environment' ? '.env-Verbindungstest läuft ...' : 'Verbindungstest läuft ...'
  aiBusy.value = true
  try {
    if (typeof api.testAiConnection !== 'function') {
      aiConnectionOk.value = false
      aiConnectionMessage.value = 'Bitte App neu starten, damit der Verbindungstest verfügbar ist.'
      actionError.value = aiConnectionMessage.value
      return
    }
    const result = await api.testAiConnection({ source })
    aiConnectionOk.value = result.ok
    aiConnectionMessage.value = result.message
    if (!result.ok) actionError.value = result.message
  } catch (error) {
    aiConnectionOk.value = false
    aiConnectionMessage.value = aiConnectionFallbackMessage(source)
    actionError.value = error instanceof Error ? error.message : String(error)
  } finally {
    aiBusy.value = false
  }
}

async function testAiConnection(): Promise<void> {
  await runAiConnectionTest('active')
}

async function testEnvironmentConnection(): Promise<void> {
  await runAiConnectionTest('environment')
}

async function generateAiDraft(): Promise<void> {
  if (!submission.value) return
  if (cloudAiDisabled) {
    actionError.value = 'KI-Korrektur ist in der Cloud-Version noch nicht freigeschaltet.'
    return
  }
  actionError.value = ''
  aiNotice.value = ''
  aiBusy.value = true
  try {
    await api.generateAiCorrectionDraft({ submissionId: submission.value.id })
    aiNotice.value = 'KI-Vorschlag erstellt.'
    await load()
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : String(error)
  } finally {
    aiBusy.value = false
  }
}

async function acceptAiDraft(id: string): Promise<void> {
  actionError.value = ''
  aiNotice.value = ''
  aiBusy.value = true
  try {
    await api.acceptAiCorrectionDraft(id)
    aiNotice.value = 'KI-Vorschlag übernommen.'
    await load()
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : String(error)
  } finally {
    aiBusy.value = false
  }
}

async function rejectAiDraft(id: string): Promise<void> {
  actionError.value = ''
  aiNotice.value = ''
  aiBusy.value = true
  try {
    await api.rejectAiCorrectionDraft(id)
    aiNotice.value = 'KI-Vorschlag verworfen.'
    await load()
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : String(error)
  } finally {
    aiBusy.value = false
  }
}

function captureSelection(): void {
  const selection = window.getSelection()
  const text = selection?.toString().trim() ?? ''
  if (!text || !paperRef.value || !selection?.anchorNode) return
  if (!paperRef.value.contains(selection.anchorNode)) return
  selectedText.value = text
  updateSelectionPopover(selection)
}

function clearSelectedText(): void {
  selectedText.value = ''
  commentBody.value = ''
  window.getSelection()?.removeAllRanges()
}

async function addComment(): Promise<void> {
  captureSelection()
  if (!submission.value || !correction.value || !canAddComment.value) {
    return
  }
  const fullText = paperRef.value?.innerText ?? ''
  const from = Math.max(0, fullText.indexOf(selectedText.value))
  const to = from + selectedText.value.length
  await api.addInlineComment({
    correctionId: correction.value.id,
    submissionId: submission.value.id,
    body: commentBody.value,
    tags: [],
    anchor: {
      type: 'prosemirror-selection',
      editorSchemaVersion: EDITOR_SCHEMA_VERSION,
      from,
      to,
      selectedText: selectedText.value,
      prefix: fullText.slice(Math.max(0, from - 40), from),
      suffix: fullText.slice(to, to + 40),
      contentHash: submission.value.contentHash
    }
  })
  commentBody.value = ''
  selectedText.value = ''
  await load()
}

function updateSelectionPopover(selection: Selection): void {
  const range = selection.rangeCount ? selection.getRangeAt(0) : null
  const container = submissionPaperRef.value
  if (!range || !container) return
  const rect = range.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  selectionPopover.value = {
    x: Math.max(180, Math.min(rect.left - containerRect.left + rect.width / 2, containerRect.width - 180)),
    y: Math.max(12, rect.top - containerRect.top - 10)
  }
}

function commentTop(comment: InlineComment, index: number): number {
  return commentPositions.value[comment.id] ?? index * 124
}

function highlightInlineComment(comment: InlineComment): void {
  clearInlineCommentHighlight()
  activeCommentId.value = comment.id
  const range = findCommentRange(comment)
  if (!range || !supportsCssHighlights()) return
  CSS.highlights.set('inline-comment-hover', new Highlight(range))
}

function updateCommentPositions(): void {
  const root = paperRef.value
  if (!root || !correction.value) return
  const rootRect = root.getBoundingClientRect()
  const nextPositions: Record<string, number> = {}
  for (const [index, comment] of correction.value.inlineComments.entries()) {
    const range = findCommentRange(comment)
    if (!range) {
      nextPositions[comment.id] = index * 124
      continue
    }
    const rect = range.getBoundingClientRect()
    nextPositions[comment.id] = Math.max(0, rect.top - rootRect.top + 8)
  }
  commentPositions.value = avoidCommentOverlap(nextPositions, correction.value.inlineComments)
  commentRailHeight.value = Math.max(root.offsetHeight, ...Object.values(commentPositions.value).map((top) => top + 150), 760)
}

function avoidCommentOverlap(
  positions: Record<string, number>,
  comments: InlineComment[]
): Record<string, number> {
  const adjusted = { ...positions }
  let previousBottom = -Infinity
  for (const comment of comments) {
    const top = Math.max(adjusted[comment.id] ?? 0, previousBottom + 10)
    adjusted[comment.id] = top
    previousBottom = top + 116
  }
  return adjusted
}

function clearInlineCommentHighlight(): void {
  activeCommentId.value = null
  if (supportsCssHighlights()) CSS.highlights.delete('inline-comment-hover')
}

function findCommentRange(comment: InlineComment): Range | null {
  const root = paperRef.value
  const selectedText = comment.anchor.selectedText
  if (!root || !selectedText) return null

  const textNodes: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let next = walker.nextNode()
  while (next) {
    textNodes.push(next as Text)
    next = walker.nextNode()
  }

  const fullText = textNodes.map((node) => node.textContent ?? '').join('')
  const anchoredText = `${comment.anchor.prefix}${selectedText}${comment.anchor.suffix}`
  const anchoredIndex = comment.anchor.prefix || comment.anchor.suffix ? fullText.indexOf(anchoredText) : -1
  const start = anchoredIndex >= 0
    ? anchoredIndex + comment.anchor.prefix.length
    : fullText.indexOf(selectedText)
  if (start < 0) return null
  const end = start + selectedText.length

  const startPosition = resolveTextPosition(textNodes, start)
  const endPosition = resolveTextPosition(textNodes, end)
  if (!startPosition || !endPosition) return null

  const range = document.createRange()
  range.setStart(startPosition.node, startPosition.offset)
  range.setEnd(endPosition.node, endPosition.offset)
  return range
}

function resolveTextPosition(nodes: Text[], offset: number): { node: Text; offset: number } | null {
  let cursor = 0
  for (const node of nodes) {
    const length = node.textContent?.length ?? 0
    if (offset <= cursor + length) {
      return { node, offset: Math.max(0, offset - cursor) }
    }
    cursor += length
  }
  const last = nodes.at(-1)
  return last ? { node: last, offset: last.textContent?.length ?? 0 } : null
}

function supportsCssHighlights(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined'
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value))
}

function waitingLabel(value: string): string {
  const submittedAt = new Date(value).getTime()
  const ageInDays = Math.max(0, Math.floor((Date.now() - submittedAt) / 86_400_000))
  if (ageInDays === 0) return 'wartet seit heute'
  if (ageInDays === 1) return 'wartet seit 1 Tag'
  return `wartet seit ${ageInDays} Tagen`
}

function parseScoreInput(value: string): number | null {
  const normalized = value.replace(',', '.').trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) {
    throw new Error('Bitte einen gültigen Punktwert eingeben.')
  }
  return parsed
}

function normalizeScoreInput(): void {
  try {
    scoreInput.value = formatScoreInput(parseScoreInput(scoreInput.value))
  } catch {
    // Keep the raw value so the user can correct it.
  }
}

function formatScoreInput(value: number | null): string {
  if (value === null) return ''
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',')
}

function formatImprovementCategory(category: AiCorrectionDraft['improvementSuggestions'][number]['category']): string {
  const labels: Record<AiCorrectionDraft['improvementSuggestions'][number]['category'], string> = {
    issue_spotting: 'Problemerkennung',
    law: 'Rechtliche Grundlagen',
    procedure: 'Verfahren',
    structure: 'Aufbau',
    argumentation: 'Argumentation',
    style: 'Stil',
    time_management: 'Zeitmanagement',
    other: 'Sonstiges'
  }
  return labels[category]
}

function formatLearningTaskPriority(priority: AiCorrectionDraft['improvementSuggestions'][number]['priority']): string {
  const labels: Record<AiCorrectionDraft['improvementSuggestions'][number]['priority'], string> = {
    low: 'niedrig',
    medium: 'mittel',
    high: 'hoch'
  }
  return labels[priority]
}
</script>
