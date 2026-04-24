<template>
  <section v-if="exam" class="exam-view" :class="{ 'focus-view': focusMode }">
    <header v-if="!focusMode" class="page-header">
      <div>
        <p class="eyebrow">{{ exam.folderName ?? 'Ohne Ordner' }}</p>
        <input v-model="title" class="title-input" @blur="saveMeta" />
        <div class="exam-header-meta">
          <span class="status-pill">{{ statusLabel(exam.status) }}</span>
          <span>{{ autosaveLabel }}</span>
          <span>Offline gespeichert</span>
          <span>Gespeichert {{ formatDate(exam.lastSavedAt) }}</span>
        </div>
      </div>
      <div class="header-actions">
        <RouterLink class="secondary" :to="{ name: 'dashboard' }">
          <ArrowLeft :size="17" />
          Bibliothek
        </RouterLink>
        <button class="secondary" @click="saveNow"><Save :size="17" /> Speichern</button>
        <RouterLink class="secondary" :to="{ name: 'exam-focus', params: { id: exam.id } }">
          <Maximize2 :size="17" />
          Prüfungsmodus
        </RouterLink>
        <button class="secondary" @click="exportPdf"><FileDown :size="17" /> PDF</button>
        <button class="secondary" @click="exportPackage"><Download :size="17" /> .jura</button>
        <button @click="openSubmitDialog"><Send :size="17" /> Abgeben</button>
      </div>
    </header>

    <header v-else class="exam-session-header">
      <div class="session-identity">
        <img :src="iconUrl" alt="" />
        <span>{{ exam.title }}</span>
      </div>
      <div class="session-actions">
        <button
          class="theme-toggle"
          :title="isDark ? 'Hellmodus' : 'Dunkelmodus'"
          @click="toggleTheme"
        >
          <span class="theme-toggle-option" :class="{ active: !isDark }">
            <Sun :size="19" />
          </span>
          <span class="theme-toggle-option" :class="{ active: isDark }">
            <Moon :size="18" />
          </span>
        </button>
        <RouterLink
          class="session-outline session-back"
          :to="{ name: 'exam', params: { id: exam.id } }"
        >
          <ArrowLeft :size="18" />
          Zurück
        </RouterLink>
        <button class="session-outline" @click="toolbarHidden = !toolbarHidden">
          {{ toolbarHidden ? 'Einblenden' : 'Ausblenden' }}
        </button>
        <button class="session-outline" @click="openSubmitDialog">Abgeben</button>
      </div>
    </header>

    <p v-if="actionError" class="action-error">{{ actionError }}</p>

    <div class="exam-layout">
      <main class="writing-pane">
        <ExamEditor
          v-model="content"
          :focus-mode="focusMode"
          :hide-toolbar="Boolean(focusMode && toolbarHidden)"
          @dirty="markDirty"
          @save="saveRevision"
          @pdf="exportPdf"
        />
        <div v-if="focusMode" class="focus-save-state">
          <Check :size="25" />
          <span>{{ autosaveLabel }}</span>
        </div>
      </main>

      <aside v-if="!focusMode" class="side-panel">
        <section>
          <h2>Status</h2>
          <div class="exam-status-grid">
            <span>Status</span>
            <strong>{{ statusLabel(exam.status) }}</strong>
            <span>Erstellt</span>
            <strong>{{ formatDate(exam.createdAt) }}</strong>
            <span>Zuletzt gespeichert</span>
            <strong>{{ formatDate(exam.lastSavedAt) }}</strong>
          </div>
        </section>

        <section>
          <h2>Metadaten</h2>
          <label>
            Ordner
            <select v-model="folderId" @change="saveMeta">
              <option :value="null">Ohne Ordner</option>
              <option v-for="folder in folders" :key="folder.id" :value="folder.id">
                {{ folder.name }}
              </option>
            </select>
          </label>
          <label>
            Tags
            <TagInput
              v-model="tags"
              :suggestions="tagSuggestions"
              placeholder="Tags hinzufügen"
              @update:modelValue="saveMeta"
            />
          </label>
          <label>
            Notizen
            <textarea v-model="notes" rows="4" @blur="saveMeta" />
          </label>
        </section>

        <section>
          <div class="panel-header">
            <h2>Dateien</h2>
            <button title="Datei hinzufügen" @click="addAttachment"><Plus :size="16" /></button>
          </div>
          <button
            v-for="attachment in exam.attachments"
            :key="attachment.id"
            class="attachment-row"
            @click="openAttachment(attachment.id)"
          >
            <Paperclip :size="16" />
            {{ attachment.originalName }}
          </button>
          <p v-if="!exam.attachments.length" class="empty-state">Keine Dateien importiert.</p>
        </section>

        <section>
          <h2>Abgaben</h2>
          <div class="submission-list">
            <div v-for="submission in exam.submissions" :key="submission.id" class="submission-row">
              <div class="submission-row-icon">
                <Check :size="16" />
              </div>
              <div class="submission-row-meta">
                <strong>Abgabe</strong>
                <span>{{ formatDate(submission.submittedAt) }}</span>
              </div>
              <RouterLink class="submission-row-action" :to="{ name: 'correction', params: { id: submission.id } }">
                Korrigieren
                <ArrowRight :size="15" />
            </RouterLink>
            </div>
          </div>
          <p v-if="!exam.submissions.length" class="empty-state">Noch keine Abgabe.</p>
        </section>
      </aside>
    </div>

    <div v-if="showSubmitDialog" class="dialog-backdrop" @click="cancelSubmitDialog">
      <div class="dialog-card" @click.stop>
        <h2>Klausur abgeben</h2>
        <p class="dialog-copy">
          Die aktuelle Fassung wird lokal gespeichert und als Abgabe festgehalten. Du kannst danach
          weiterarbeiten, aber diese Abgabe bleibt als eigener Offline-Stand erhalten.
        </p>
        <div class="dialog-actions">
          <button type="button" class="secondary" @click="cancelSubmitDialog">Abbrechen</button>
          <button type="button" @click="confirmSubmitExam">
            <Send :size="17" />
            Abgeben
          </button>
        </div>
      </div>
    </div>

    <Transition name="submission-celebration">
      <div
        v-if="showSubmissionOverlay"
        class="submission-celebration"
        role="status"
        aria-live="polite"
        @click="dismissSubmissionOverlay"
      >
        <div class="submission-celebration-card" @click.stop>
          <div class="submission-confetti" aria-hidden="true">
            <span
              v-for="piece in confettiPieces"
              :key="piece.id"
              class="confetti-piece"
              :style="piece.style"
            />
          </div>
          <img :src="submissionImageUrl" alt="" class="submission-celebration-image" />
          <h2>Klausur abgegeben</h2>
          <p>Die Abgabe ist lokal gespeichert und bleibt auch nach einem Neustart verfügbar.</p>
          <button class="submission-celebration-action" @click="dismissSubmissionOverlay">
            Weiter
          </button>
        </div>
      </div>
    </Transition>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  FileDown,
  Maximize2,
  Moon,
  Paperclip,
  Plus,
  Send,
  Save,
  Sun
} from 'lucide-vue-next'
import type { ExamDetails, FolderDto } from '@shared/ipc'
import type { ExamStatus } from '@shared/schemas'
import { EMPTY_TIPTAP_DOCUMENT } from '@shared/constants'
import { api } from '../api'
import ExamEditor from '../components/ExamEditor.vue'
import TagInput from '../components/TagInput.vue'
import { useTheme } from '../theme'

defineProps<{ focusMode?: boolean }>()

const route = useRoute()
const router = useRouter()
const exam = ref<ExamDetails | null>(null)
const folders = ref<FolderDto[]>([])
const tagSuggestions = ref<string[]>([])
const title = ref('')
const folderId = ref<string | null>(null)
const tags = ref<string[]>([])
const notes = ref('')
const content = ref<Record<string, unknown>>(structuredClone(EMPTY_TIPTAP_DOCUMENT))
const toolbarHidden = ref(false)
const iconUrl = 'assets/icon.png'
const submissionImageUrl = 'assets/submission.png'
const actionError = ref('')
const autosaveLabel = ref('Entwurf lokal gespeichert')
const showSubmitDialog = ref(false)
const showSubmissionOverlay = ref(false)
const { isDark, toggleTheme } = useTheme()
let submissionOverlayTimer: ReturnType<typeof window.setTimeout> | null = null
const SUBMISSION_OVERLAY_MS = 10_000

const confettiPieces = Array.from({ length: 24 }, (_value, index) => ({
  id: index,
  style: {
    left: `${4 + ((index * 4.1) % 92)}%`,
    animationDelay: `${(index % 6) * 0.09}s`,
    animationDuration: `${2.1 + (index % 5) * 0.16}s`,
    background: ['#008bd2', '#70d6ff', '#ffca3a', '#8ac926', '#ff6b6b', '#6a4c93'][index % 6],
    transform: `rotate(${(index * 17) % 360}deg)`
  }
}))

onMounted(load)
onBeforeUnmount(() => clearSubmissionOverlayTimer())

watch(
  () => route.params.id,
  () => load()
)

async function load(): Promise<void> {
  const [nextFolders, exams, nextExam] = await Promise.all([
    api.listFolders(),
    api.listExams(),
    api.getExam(String(route.params.id))
  ])
  folders.value = nextFolders
  tagSuggestions.value = [...new Set(exams.flatMap((entry) => entry.tags))].sort((left, right) =>
    left.localeCompare(right, 'de-DE')
  )
  exam.value = nextExam
  title.value = exam.value.title
  folderId.value = exam.value.folderId
  tags.value = [...exam.value.tags]
  notes.value = exam.value.notes
  content.value =
    exam.value.currentRevision?.content ??
    (structuredClone(EMPTY_TIPTAP_DOCUMENT) as unknown as Record<string, unknown>)
  autosaveLabel.value = 'Entwurf lokal gespeichert'
}

async function saveRevision(nextContent: Record<string, unknown>): Promise<void> {
  if (!exam.value) return
  autosaveLabel.value = 'Speichern...'
  try {
    await api.saveRevision({ examId: exam.value.id, content: plainContent(nextContent), kind: 'autosave' })
    exam.value = await api.getExam(exam.value.id)
    autosaveLabel.value = 'Entwurf lokal gespeichert'
  } catch (error) {
    autosaveLabel.value = 'Speichern fehlgeschlagen'
    actionError.value = error instanceof Error ? error.message : String(error)
    console.error(error)
  }
}

async function saveNow(): Promise<void> {
  if (!exam.value) return
  await runAction(async () => {
    if (!exam.value) return
    autosaveLabel.value = 'Speichern...'
    await api.saveRevision({ examId: exam.value.id, content: plainContent(content.value), kind: 'manual' })
    exam.value = await api.getExam(exam.value.id)
    autosaveLabel.value = 'Entwurf lokal gespeichert'
  })
}

async function saveMeta(): Promise<void> {
  if (!exam.value) return
  exam.value = await api.updateExam({
    id: exam.value.id,
    title: title.value,
    folderId: folderId.value,
    tags: [...tags.value],
    notes: notes.value
  })
  tags.value = [...exam.value.tags]
  tagSuggestions.value = [...new Set([...tagSuggestions.value, ...exam.value.tags])].sort((left, right) =>
    left.localeCompare(right, 'de-DE')
  )
}

async function addAttachment(): Promise<void> {
  if (!exam.value) return
  await api.addAttachment(exam.value.id)
  await load()
}

async function openAttachment(id: string): Promise<void> {
  await api.openAttachment(id)
}

function openSubmitDialog(): void {
  showSubmitDialog.value = true
}

function cancelSubmitDialog(): void {
  showSubmitDialog.value = false
}

async function confirmSubmitExam(): Promise<void> {
  showSubmitDialog.value = false
  if (!exam.value) return
  await runAction(async () => {
    if (!exam.value) return
    await api.saveRevision({ examId: exam.value.id, content: plainContent(content.value), kind: 'manual' })
    await api.submitExam(exam.value.id)
    await load()
    triggerSubmissionOverlay()
  })
}

async function exportPackage(): Promise<void> {
  if (!exam.value) return
  await runAction(async () => {
    if (!exam.value) return
    await api.exportExamPackage(exam.value.id)
  })
}

async function exportPdf(): Promise<void> {
  if (!exam.value) return
  await runAction(async () => {
    if (!exam.value) return
    await api.saveRevision({ examId: exam.value.id, content: plainContent(content.value), kind: 'manual' })
    await api.exportExamPdf(exam.value.id)
    await load()
  })
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value))
}

function statusLabel(status: ExamStatus): string {
  return {
    draft: 'Entwurf',
    in_progress: 'In Bearbeitung',
    submitted: 'Abgegeben',
    corrected: 'Korrigiert',
    archived: 'Archiviert'
  }[status]
}

function markDirty(): void {
  autosaveLabel.value = 'Noch nicht lokal gespeichert'
}

async function runAction(action: () => Promise<void>): Promise<void> {
  actionError.value = ''
  try {
    await action()
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : String(error)
    console.error(error)
  }
}

function plainContent(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

function triggerSubmissionOverlay(): void {
  clearSubmissionOverlayTimer()
  showSubmissionOverlay.value = true
  submissionOverlayTimer = window.setTimeout(() => {
    showSubmissionOverlay.value = false
    submissionOverlayTimer = null
  }, SUBMISSION_OVERLAY_MS)
}

function dismissSubmissionOverlay(): void {
  clearSubmissionOverlayTimer()
  showSubmissionOverlay.value = false
}

function clearSubmissionOverlayTimer(): void {
  if (!submissionOverlayTimer) return
  clearTimeout(submissionOverlayTimer)
  submissionOverlayTimer = null
}
</script>
