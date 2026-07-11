<template>
  <section class="dashboard">
    <header class="page-header">
      <div>
        <UBreadcrumb class="app-breadcrumb" :items="withHomeIcon(breadcrumbItems)" />
        <p class="eyebrow">Lokale Bibliothek</p>
        <h1>Bibliothek</h1>
      </div>
      <div class="header-actions">
        <UButton color="neutral" variant="outline" @click="importPackage">
          <Upload :size="17" />
          Importieren
        </UButton>
      </div>
    </header>

    <section class="metric-row">
      <div class="metric">
        <span>Prüfungen</span>
        <strong>{{ store.examTotal }}</strong>
      </div>
      <div class="metric">
        <span>Abgegeben</span>
        <strong>{{ store.submittedCount }}</strong>
      </div>
      <div class="metric">
        <span>Korrigiert</span>
        <strong>{{ store.correctedCount }}</strong>
      </div>
      <div class="metric">
        <span>Schnitt</span>
        <strong>{{ store.averageScore ?? '—' }}</strong>
      </div>
    </section>

    <section class="work-grid">
      <aside class="panel">
        <div class="panel-header">
          <h2>Ordner</h2>
          <UButton class="compact-button" color="neutral" variant="outline" title="Ordner erstellen" @click="openCreateFolderDialog">
            <FolderPlus :size="16" />
            Neuer Ordner
          </UButton>
        </div>
        <UButton
          class="folder-row"
          :class="{ active: selectedFolderId === null }"
          @click="selectFolder(null)"
        >
          Alle Einträge
        </UButton>
        <UButton
          class="folder-row"
          :class="{ active: selectedFolderId === UNASSIGNED_FOLDER_ID, 'drop-target': dropFolderId === null }"
          @click="selectFolder(UNASSIGNED_FOLDER_ID)"
          @dragover.prevent="onFolderDragOver(null)"
          @dragleave="onFolderDragLeave(null)"
          @drop.prevent="dropOnFolder(null)"
        >
          Ohne Ordner
        </UButton>
        <UButton
          v-for="folder in store.folders"
          v-show="!folder.trashedAt"
          :key="folder.id"
          class="folder-row"
          :class="{ active: selectedFolderId === folder.id, 'drop-target': dropFolderId === folder.id }"
          @click="selectFolder(folder.id)"
          @contextmenu.prevent="openFolderMenu($event, folder.id)"
          @dragover.prevent="onFolderDragOver(folder.id)"
          @dragleave="onFolderDragLeave(folder.id)"
          @drop.prevent="dropOnFolder(folder.id)"
        >
          {{ folder.name }}
        </UButton>
        <p class="folder-drop-hint">Eintrag auf einen Ordner ziehen, um ihn zu verschieben.</p>

        <div class="folder-actions-divider" />
        <section
          class="trash-section"
          :class="{ 'drop-target': dropTrashActive }"
          @dragover.prevent="onTrashDragOver"
          @dragleave="onTrashDragLeave"
          @drop.prevent="dropOnTrash"
        >
          <div class="panel-header">
            <h3>Papierkorb</h3>
            <span>{{ trashCount }}</span>
          </div>
          <div v-if="trashCount" class="trash-list">
            <div v-for="exam in trashedExams" :key="exam.id" class="trash-row">
              <div class="trash-row-meta">
                <strong>{{ exam.title }}</strong>
                <span>Klausur · {{ formatDate(exam.updatedAt) }}</span>
              </div>
              <UButton color="neutral" variant="outline" @click="restoreExam(exam.id)">
                <RotateCcw :size="15" />
                Wiederherstellen
              </UButton>
            </div>
            <div v-for="folder in trashedFolders" :key="folder.id" class="trash-row">
              <div class="trash-row-meta">
                <strong>{{ folder.name }}</strong>
                <span>Ordner · {{ formatDate(folder.trashedAt) }}</span>
              </div>
              <UButton color="neutral" variant="outline" @click="restoreFolder(folder.id)">
                <RotateCcw :size="15" />
                Wiederherstellen
              </UButton>
            </div>
          </div>
          <p v-else class="empty-state">Klausur hierher ziehen, um sie in den Papierkorb zu legen.</p>
        </section>
      </aside>

      <section class="panel">
        <div class="panel-header">
          <h2>Klausuren</h2>
          <span v-if="store.refreshing" class="list-loading-indicator">
            <span class="loading-spinner" aria-hidden="true" />
            <span>Lade Einträge</span>
          </span>
          <UButton @click="openCreateExamDialog">
            <Plus :size="17" />
            Neue Klausur
          </UButton>
        </div>

        <div v-if="store.loading" class="skeleton-list" aria-hidden="true">
          <UCard v-for="index in 5" :key="index" class="skeleton-tile"><USkeleton class="h-5 w-2/5" /><USkeleton class="mt-3 h-4 w-full" /></UCard>
        </div>
        <p v-else-if="store.error" class="action-notice error">
          <span>{{ store.error }}</span>
          <UButton type="button" color="neutral" variant="outline" @click="reloadExams">Erneut versuchen</UButton>
        </p>
        <div
          v-else
          class="exam-list"
          :class="{ 'paginated-list-refreshing': store.refreshing }"
          :aria-busy="store.refreshing"
        >
          <RouterLink
            v-for="exam in filteredExams"
            :key="exam.id"
            class="exam-row"
            :class="{ dragging: draggedExamId === exam.id }"
            :to="{ name: 'exam', params: { id: exam.id } }"
            draggable="true"
            @contextmenu.prevent="openExamMenu($event, exam.id)"
            @dragstart="startExamDrag($event, exam.id)"
            @dragend="endExamDrag"
          >
            <FileText :size="20" />
            <div class="exam-summary">
              <strong>{{ exam.title }}</strong>
              <span>{{ exam.folderName ?? 'Ohne Ordner' }} · {{ statusLabel(exam.status) }}</span>
              <div class="exam-dates">
                <span>Erstellt {{ formatDate(exam.createdAt) }}</span>
                <span>Gespeichert {{ formatDate(exam.lastSavedAt) }}</span>
              </div>
            </div>
            <div class="tag-list">
              <span v-for="tag in exam.tags" :key="tag" class="tag">{{ tag }}</span>
            </div>
            <span class="score">{{ exam.latestScore ?? '—' }}</span>
          </RouterLink>
          <p v-if="!filteredExams.length" class="empty-state">Noch keine Einträge in dieser Ansicht.</p>
        </div>
        <nav
          v-if="!store.loading && !store.error && store.examTotal > 0"
          class="app-pagination"
          label="Klausurseiten"
        >
          <span>{{ (store.examPage - 1) * store.examPageSize + 1 }}-{{ Math.min(store.examTotal, store.examPage * store.examPageSize) }} von {{ store.examTotal }}</span>
          <UPagination :model-value="store.examPage" :total="store.examTotal" :items-per-page="store.examPageSize" :disabled="store.refreshing" @update:model-value="setExamPage" />
          <USelect :model-value="store.examPageSize" :items="pageSizeOptions" :disabled="store.refreshing" @update:model-value="setExamPageSize" />
        </nav>
      </section>
    </section>

    <div v-if="folderMenu" class="context-menu-backdrop" @click="closeFolderMenu" @contextmenu.prevent="closeFolderMenu" />
    <div
      v-if="folderMenu && menuFolder"
      class="context-menu"
      :style="{ left: `${folderMenu.x}px`, top: `${folderMenu.y}px` }"
      @click.stop
    >
      <UButton @click="startRenameFolder(menuFolder.id)">
        <Pencil :size="15" />
        Umbenennen
      </UButton>
      <UButton class="context-menu-danger" @click="startTrashFolder(menuFolder.id)">
        <Trash2 :size="15" />
        In Papierkorb
      </UButton>
    </div>

    <div v-if="examMenu" class="context-menu-backdrop" @click="closeExamMenu" @contextmenu.prevent="closeExamMenu" />
    <div
      v-if="examMenu && menuExam"
      class="context-menu"
      :style="{ left: `${examMenu.x}px`, top: `${examMenu.y}px` }"
      @click.stop
    >
      <UButton @click="openExam(menuExam.id)">
        <FileText :size="15" />
        Anzeigen
      </UButton>
      <UButton @click="openExam(menuExam.id)">
        <Pencil :size="15" />
        Bearbeiten
      </UButton>
      <UButton @click="startRenameExam(menuExam.id)">
        <Pencil :size="15" />
        Umbenennen
      </UButton>
      <UButton @click="downloadExam(menuExam.id)">
        <Download :size="15" />
        Download
      </UButton>
      <UButton class="context-menu-danger" @click="trashExam(menuExam.id)">
        <Trash2 :size="15" />
        In Papierkorb
      </UButton>
    </div>

    <UModal :open="showCreateFolderDialog" @update:open="showCreateFolderDialog = $event">
      <template #content><div class="dialog-card">
        <h2>Neuer Ordner</h2>
        <form class="dialog-form" @submit.prevent="createFolder">
          <label class="dialog-field">
            Name
            <UInput v-model="folderName" placeholder="Ordnername" autofocus />
          </label>
          <div class="dialog-actions">
            <UButton type="button" color="neutral" variant="outline" @click="cancelCreateFolder">Abbrechen</UButton>
            <UButton type="submit">
              <FolderPlus :size="16" />
              Erstellen
            </UButton>
          </div>
        </form>
      </div></template>
    </UModal>

    <UModal :open="showCreateExamDialog" @update:open="showCreateExamDialog = $event">
      <template #content><div class="dialog-card dialog-card-wide">
        <h2>Neue Klausur</h2>
        <form class="dialog-form" @submit.prevent="createExam">
          <label class="dialog-field">
            Titel
            <UInput v-model="examTitle" placeholder="Titel" autofocus />
          </label>
          <label class="dialog-field">
            Ordner
            <USelect v-model="examFolderId" :items="folderOptions" value-key="value" />
          </label>
          <div class="dialog-field">
            <span>Tags</span>
            <TagInput v-model="tagValues" :suggestions="tagSuggestions" placeholder="Tags hinzufügen" />
          </div>
          <div class="dialog-actions">
            <UButton type="button" color="neutral" variant="outline" @click="cancelCreateExam">Abbrechen</UButton>
            <UButton type="submit">
              <Plus :size="17" />
              Erstellen
            </UButton>
          </div>
        </form>
      </div></template>
    </UModal>

    <UModal :open="Boolean(renameExam)" @update:open="!$event && cancelRenameExam()">
      <template #content><div class="dialog-card">
        <h2>Klausur umbenennen</h2>
        <form class="dialog-form" @submit.prevent="submitRenameExam">
          <label class="dialog-field">
            Titel
            <UInput v-model="renameExamTitle" placeholder="Titel" autofocus />
          </label>
          <div class="dialog-actions">
            <UButton type="button" color="neutral" variant="outline" @click="cancelRenameExam">Abbrechen</UButton>
            <UButton type="submit">Speichern</UButton>
          </div>
        </form>
      </div></template>
    </UModal>

    <UModal :open="Boolean(renameFolder)" @update:open="!$event && cancelRenameFolder()">
      <template #content><div class="dialog-card">
        <h2>Ordner umbenennen</h2>
        <form class="dialog-form" @submit.prevent="submitRenameFolder">
          <UInput v-model="renameFolderName" placeholder="Ordnername" />
          <div class="dialog-actions">
            <UButton type="button" color="neutral" variant="outline" @click="cancelRenameFolder">Abbrechen</UButton>
            <UButton type="submit">Speichern</UButton>
          </div>
        </form>
      </div></template>
    </UModal>

    <UModal :open="Boolean(trashFolderState)" @update:open="!$event && cancelTrashFolder()">
      <template #content><div class="dialog-card">
        <h2>Ordner in Papierkorb verschieben</h2>
        <p class="dialog-copy">
          Der Ordner wird nicht gelöscht. Lege fest, wohin die enthaltenen Einträge verschoben
          werden sollen.
        </p>
        <label class="dialog-field">
          Zielordner für Einträge
          <USelect v-model="trashMoveTargetId" :items="trashTargetOptions" value-key="value" />
        </label>
        <div class="dialog-actions">
          <UButton type="button" color="neutral" variant="outline" @click="cancelTrashFolder">Abbrechen</UButton>
          <UButton type="button" color="error" @click="submitTrashFolder">
            In Papierkorb
          </UButton>
        </div>
      </div></template>
    </UModal>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Download, FileText, FolderPlus, Pencil, Plus, RotateCcw, Trash2, Upload } from 'lucide-vue-next'
import type { ExamStatus } from '@shared/schemas'
import TagInput from '../components/TagInput.vue'
import { type AppBreadcrumbItem, withHomeIcon } from '../ui/breadcrumbs'
import { useLibraryStore } from '../stores/library'

const store = useLibraryStore()
const router = useRouter()
const folderName = ref('')
const examTitle = ref('')
const tagValues = ref<string[]>([])
const examFolderId = ref<string | null>(null)
const showCreateFolderDialog = ref(false)
const showCreateExamDialog = ref(false)
const UNASSIGNED_FOLDER_ID = '__unassigned__'
const selectedFolderId = ref<string | null>(null)
const draggedExamId = ref<string | null>(null)
const dropFolderId = ref<string | null | undefined>(undefined)
const dropTrashActive = ref(false)
const folderMenu = ref<{ folderId: string; x: number; y: number } | null>(null)
const examMenu = ref<{ examId: string; x: number; y: number } | null>(null)
const renameFolderId = ref<string | null>(null)
const renameFolderName = ref('')
const renameExamId = ref<string | null>(null)
const renameExamTitle = ref('')
const trashFolderId = ref<string | null>(null)
const trashMoveTargetId = ref<string | null>(null)
const pageSizeOptions = [10, 25, 50, 100]

onMounted(() => store.load())

const activeFolders = computed(() => store.folders.filter((folder) => !folder.trashedAt))
const trashedFolders = computed(() => store.folders.filter((folder) => folder.trashedAt))
const activeExams = computed(() => store.exams)
const trashedExams = computed(() => store.archivedExams)
const trashCount = computed(() => trashedFolders.value.length + store.archivedExamTotal)
const menuFolder = computed(
  () => store.folders.find((folder) => folder.id === folderMenu.value?.folderId) ?? null
)
const menuExam = computed(
  () => store.exams.find((exam) => exam.id === examMenu.value?.examId) ?? null
)
const renameFolder = computed(
  () => store.folders.find((folder) => folder.id === renameFolderId.value) ?? null
)
const renameExam = computed(
  () => store.exams.find((exam) => exam.id === renameExamId.value) ?? null
)
const trashFolderState = computed(
  () => store.folders.find((folder) => folder.id === trashFolderId.value) ?? null
)
const trashTargetFolders = computed(() =>
  activeFolders.value.filter((folder) => folder.id !== trashFolderId.value)
)
const folderOptions = computed(() => [
  { label: 'Kein Ordner', value: null },
  ...activeFolders.value.map((folder) => ({ label: folder.name, value: folder.id }))
])
const trashTargetOptions = computed(() => [
  { label: 'Ohne Ordner', value: null },
  ...trashTargetFolders.value.map((folder) => ({ label: folder.name, value: folder.id }))
])
const selectedFolderLabel = computed(() => {
  if (!selectedFolderId.value) return null
  if (selectedFolderId.value === UNASSIGNED_FOLDER_ID) return 'Ohne Ordner'
  return activeFolders.value.find((folder) => folder.id === selectedFolderId.value)?.name ?? null
})
const breadcrumbItems = computed<AppBreadcrumbItem[]>(() => [
  { label: 'Home', to: { name: 'home' } },
  { label: 'Prüfungen', to: { name: 'exams' } },
  { label: 'Bibliothek' },
  ...(selectedFolderLabel.value ? [{ label: selectedFolderLabel.value }] : [])
])

const filteredExams = computed(() => activeExams.value)

const tagSuggestions = computed(() =>
  [...new Set(store.exams.flatMap((exam) => exam.tags.map((tag) => tag.trim())).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, 'de-DE')
  )
)

watch(activeFolders, (folders) => {
  if (
    selectedFolderId.value &&
    selectedFolderId.value !== UNASSIGNED_FOLDER_ID &&
    !folders.some((folder) => folder.id === selectedFolderId.value)
  ) {
    selectedFolderId.value = null
  }
  if (examFolderId.value && !folders.some((folder) => folder.id === examFolderId.value)) {
    examFolderId.value = null
  }
})

function selectedFolderFilter(): string | null | undefined {
  if (!selectedFolderId.value) return undefined
  if (selectedFolderId.value === UNASSIGNED_FOLDER_ID) return null
  return selectedFolderId.value
}

async function selectFolder(folderId: string | null): Promise<void> {
  selectedFolderId.value = folderId
  await store.loadExamPage({ page: 1, folderId: selectedFolderFilter() })
}

async function setExamPage(page: number): Promise<void> {
  await store.loadExamPage({ page, folderId: selectedFolderFilter() })
}

async function setExamPageSize(pageSize: number): Promise<void> {
  await store.loadExamPage({ page: 1, pageSize, folderId: selectedFolderFilter() })
}

async function reloadExams(): Promise<void> {
  await store.loadExamPage({ folderId: selectedFolderFilter() })
}

function openCreateFolderDialog(): void {
  folderName.value = ''
  showCreateFolderDialog.value = true
}

function cancelCreateFolder(): void {
  showCreateFolderDialog.value = false
  folderName.value = ''
}

async function createFolder(): Promise<void> {
  if (!folderName.value.trim()) return
  await store.createFolder(folderName.value)
  cancelCreateFolder()
}

function openCreateExamDialog(): void {
  examTitle.value = ''
  tagValues.value = []
  examFolderId.value =
    selectedFolderId.value && selectedFolderId.value !== UNASSIGNED_FOLDER_ID
      ? selectedFolderId.value
      : null
  showCreateExamDialog.value = true
}

function cancelCreateExam(): void {
  showCreateExamDialog.value = false
  examTitle.value = ''
  tagValues.value = []
}

async function createExam(): Promise<void> {
  if (!examTitle.value.trim()) return
  const exam = await store.createExam(examTitle.value, examFolderId.value, tagValues.value)
  cancelCreateExam()
  await router.push({ name: 'exam', params: { id: exam.id } })
}

async function importPackage(): Promise<void> {
  const exam = await store.importPackage()
  if (exam) await router.push({ name: 'exam', params: { id: exam.id } })
}

function openFolderMenu(event: MouseEvent, folderId: string): void {
  folderMenu.value = { folderId, x: event.clientX, y: event.clientY }
}

function closeFolderMenu(): void {
  folderMenu.value = null
}

function openExamMenu(event: MouseEvent, examId: string): void {
  examMenu.value = { examId, x: event.clientX, y: event.clientY }
}

function closeExamMenu(): void {
  examMenu.value = null
}

async function openExam(examId: string): Promise<void> {
  closeExamMenu()
  await router.push({ name: 'exam', params: { id: examId } })
}

function startRenameExam(examId: string): void {
  const exam = store.exams.find((candidate) => candidate.id === examId)
  if (!exam) return
  renameExamId.value = examId
  renameExamTitle.value = exam.title
  closeExamMenu()
}

function cancelRenameExam(): void {
  renameExamId.value = null
  renameExamTitle.value = ''
}

async function submitRenameExam(): Promise<void> {
  if (!renameExamId.value || !renameExamTitle.value.trim()) return
  await store.renameExam(renameExamId.value, renameExamTitle.value)
  cancelRenameExam()
}

async function downloadExam(examId: string): Promise<void> {
  closeExamMenu()
  await store.exportExamPackage(examId)
}

async function trashExam(examId: string): Promise<void> {
  closeExamMenu()
  await store.trashExam(examId)
}

function startRenameFolder(folderId: string): void {
  const folder = store.folders.find((candidate) => candidate.id === folderId)
  if (!folder) return
  renameFolderId.value = folderId
  renameFolderName.value = folder.name
  closeFolderMenu()
}

function cancelRenameFolder(): void {
  renameFolderId.value = null
  renameFolderName.value = ''
}

async function submitRenameFolder(): Promise<void> {
  if (!renameFolderId.value || !renameFolderName.value.trim()) return
  await store.renameFolder(renameFolderId.value, renameFolderName.value)
  cancelRenameFolder()
}

function startTrashFolder(folderId: string): void {
  trashFolderId.value = folderId
  trashMoveTargetId.value = null
  closeFolderMenu()
}

function cancelTrashFolder(): void {
  trashFolderId.value = null
  trashMoveTargetId.value = null
}

async function submitTrashFolder(): Promise<void> {
  if (!trashFolderId.value) return
  const folderId = trashFolderId.value
  await store.trashFolder(folderId, trashMoveTargetId.value)
  if (selectedFolderId.value === folderId) selectedFolderId.value = null
  if (examFolderId.value === folderId) examFolderId.value = null
  cancelTrashFolder()
}

async function restoreFolder(folderId: string): Promise<void> {
  await store.restoreFolder(folderId)
}

function startExamDrag(event: DragEvent, examId: string): void {
  draggedExamId.value = examId
  dropFolderId.value = undefined
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', examId)
  }
}

function endExamDrag(): void {
  draggedExamId.value = null
  dropFolderId.value = undefined
  dropTrashActive.value = false
}

function onFolderDragOver(folderId: string | null): void {
  if (!draggedExamId.value) return
  dropFolderId.value = folderId
}

function onFolderDragLeave(folderId: string | null): void {
  if (dropFolderId.value === folderId) dropFolderId.value = undefined
}

async function dropOnFolder(folderId: string | null): Promise<void> {
  const examId = draggedExamId.value
  draggedExamId.value = null
  dropFolderId.value = undefined
  dropTrashActive.value = false
  if (!examId) return
  await store.moveExam(examId, folderId)
}

function onTrashDragOver(): void {
  if (!draggedExamId.value) return
  dropFolderId.value = undefined
  dropTrashActive.value = true
}

function onTrashDragLeave(): void {
  dropTrashActive.value = false
}

async function dropOnTrash(): Promise<void> {
  const examId = draggedExamId.value
  draggedExamId.value = null
  dropFolderId.value = undefined
  dropTrashActive.value = false
  if (!examId) return
  await store.trashExam(examId)
}

async function restoreExam(examId: string): Promise<void> {
  await store.restoreExam(examId)
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

function formatDate(value: string | null): string {
  if (!value) return ''
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value))
}
</script>
