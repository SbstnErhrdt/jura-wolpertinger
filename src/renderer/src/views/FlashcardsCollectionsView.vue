<template>
  <section class="page flashcards-page">
    <header class="page-header">
      <div>
        <AppBreadcrumb :items="breadcrumbItems" />
        <p class="eyebrow">Karteikarten</p>
        <h1>Sammlungen</h1>
        <p>Sammlungen bündeln deine Karteikarten nach Rechtsgebiet, Kurs oder Lernziel.</p>
      </div>
      <div class="header-actions">
        <UButton type="button" @click="openCreateCollectionDialog">
          <Plus :size="17" aria-hidden="true" />
          Neue Sammlung
        </UButton>
        <UButton color="neutral" variant="outline" type="button" @click="triggerImport">
          <Upload :size="17" aria-hidden="true" />
          Datei auswählen
        </UButton>
        <UButton color="neutral" variant="outline" type="button" @click="exportDecks">
          <Download :size="17" aria-hidden="true" />
          Karten sichern
        </UButton>
      </div>
    </header>

    <div ref="importControl" class="visually-hidden">
      <UInput aria-label="Karteikarten-Datei" type="file" accept="application/json,.json" @change="importDecks" />
    </div>
    <UAlert v-if="transferMessage" class="action-notice" :color="transferMessageKind === 'error' ? 'error' : 'info'" :description="transferMessage">
      <template v-if="showImportPrompt" #actions>
        <UButton color="neutral" variant="outline" type="button" @click="triggerImport">Karteikarten-Datei auswählen</UButton>
      </template>
    </UAlert>

    <section v-if="catalog && !loadError" class="study-recommendation" aria-labelledby="study-recommendation-title">
      <div class="study-recommendation-copy">
        <p class="eyebrow">Dein nächster Schritt · aus allen Sammlungen</p>
        <h2 id="study-recommendation-title">Als Nächstes lernen</h2>
        <template v-if="recommendation && recommendedAction">
          <p class="study-recommendation-subject">{{ recommendation.collection.subject || 'Allgemein' }}</p>
          <h3>{{ recommendation.collection.name }}</h3>
          <p>{{ recommendedAction.reason }}</p>
        </template>
        <p v-else-if="!catalog.collectionCount">Lege eine Sammlung an oder wähle eine Karteikarten-Datei aus, um loszulegen.</p>
        <p v-else-if="!catalog.eligibleCollectionCount">Aktuell gibt es keine lernbaren Karten. Öffne eine Sammlung, um Karten hinzuzufügen oder pausierte Karten zu prüfen.</p>
        <p v-else>Aktuell ist nichts zur Wiederholung fällig. Du kannst unten eine Sammlung frei auswählen.</p>
      </div>
      <UButton v-if="recommendedAction" class="study-recommendation-action" :to="{ name: 'flashcards-review', query: recommendedAction.query }">
        <Play :size="17" aria-hidden="true" />
        {{ recommendedAction.label }}
      </UButton>
    </section>

    <div class="collection-search">
      <UFormField label="Sammlungen suchen" class="collection-search-field">
        <UInput v-model="search" type="search" icon="i-lucide-search" placeholder="Name oder Rechtsgebiet" aria-label="Sammlungen suchen" />
      </UFormField>
      <UButton v-if="search" type="button" color="neutral" variant="outline" @click="resetSearch">Suche zurücksetzen</UButton>
      <p class="collection-result-count" role="status" aria-live="polite">
        {{ loading ? 'Sammlungen werden geladen …' : loadError ? '' : `${catalog?.total ?? 0} ${catalog?.total === 1 ? 'Sammlung' : 'Sammlungen'}${search.trim() ? ' gefunden' : ''}` }}
      </p>
    </div>
    <UAlert v-if="loadError" color="error" :description="loadError">
      <template #actions><UButton type="button" color="neutral" variant="outline" @click="load">Erneut versuchen</UButton></template>
    </UAlert>
    <div v-else-if="loading" class="collection-loading" role="status">Die Übersicht wird geladen …</div>
    <div v-else-if="!collections.length" class="collection-empty" role="status">
      <h2>{{ search.trim() ? 'Keine passenden Sammlungen gefunden.' : 'Noch keine Sammlungen vorhanden.' }}</h2>
      <p>{{ search.trim() ? 'Versuche einen anderen Namen oder ein Rechtsgebiet.' : 'Erstelle deine erste Sammlung oder wähle oben eine Karteikarten-Datei aus.' }}</p>
    </div>

    <div v-else class="collection-grid">
      <UCard v-for="collection in collections" :key="collection.id" class="collection-card">
        <div class="collection-card-header">
          <div class="collection-card-icon" aria-hidden="true">
            <FolderKanban :size="18" />
          </div>
          <div class="collection-card-title">
            <p>{{ collection.subject || 'Allgemein' }}</p>
            <h2 :title="collection.name">{{ collection.name }}</h2>
          </div>
        </div>
        <div class="collection-stats">
          <span>
            <Layers :size="15" aria-hidden="true" />
            <strong>{{ collection.overview.eligibleCards }}</strong>
            lernbare Karten
          </span>
          <span>
            <Clock3 :size="15" aria-hidden="true" />
            <strong>{{ collection.overview.newCards }}</strong>
            noch neu
          </span>
        </div>
        <div class="collection-review-hint">
          <UButton v-if="collection.overview.dueCards" color="neutral" variant="link" :to="{ name: 'flashcards-review', query: { collection: collection.id, mode: 'review' } }">{{ collection.overview.dueCards }} Wiederholungen empfohlen</UButton>
          <span v-if="collection.overview.pausedCards">{{ collection.overview.pausedCards }} Karten pausiert</span>
        </div>
        <div class="collection-card-actions">
          <UButton :disabled="!collection.overview.eligibleCards" :to="collection.overview.eligibleCards ? { name: 'flashcards-review', query: collectionEntry(collection).query } : undefined">
            <Play :size="16" aria-hidden="true" />
            {{ collection.overview.eligibleCards ? collectionEntry(collection).label : 'Keine lernbaren Karten' }}
          </UButton>
          <UButton color="neutral" variant="outline" :to="{ name: 'flashcards-collection', params: { id: collection.id } }">
            <FolderOpen :size="16" aria-hidden="true" />
            Öffnen
          </UButton>
        </div>
        <div class="collection-progress">
          <template v-if="collection.overview.eligibleCards">
            <div class="collection-progress-caption">
              <span>{{ collection.overview.reviewedCards }} von {{ collection.overview.eligibleCards }} Karten einmal bearbeitet</span>
              <strong>{{ studyProgress(collection.overview) }} %</strong>
            </div>
            <div class="collection-progress-track" role="progressbar" :aria-label="`Bearbeitungsfortschritt: ${collection.name}`" :aria-valuenow="studyProgress(collection.overview) ?? 0" :aria-valuemin="0" :aria-valuemax="100" :aria-valuetext="`${collection.overview.reviewedCards} von ${collection.overview.eligibleCards} lernbaren Karten einmal bearbeitet`">
              <span :style="{ width: `${studyProgress(collection.overview)}%` }" />
            </div>
          </template>
          <p v-else>Keine lernbaren Karten</p>
        </div>
      </UCard>
    </div>

    <nav v-if="catalog && catalog.total > STUDY_CATALOG_PAGE_SIZE && !loadError" class="collection-pagination" aria-label="Sammlungsseiten">
      <UButton type="button" color="neutral" variant="outline" :disabled="loading || page === 1" @click="changePage(page - 1)">Vorherige Seite</UButton>
      <span>Seite {{ page }} von {{ pageCount }}</span>
      <UButton type="button" color="neutral" variant="outline" :disabled="loading || page >= pageCount" @click="changePage(page + 1)">Nächste Seite</UButton>
    </nav>

    <UModal :open="showCreateCollectionDialog" @update:open="showCreateCollectionDialog = $event">
      <template #content>
      <div class="dialog-card">
        <h2>Neue Sammlung</h2>
        <p class="dialog-copy">Lege einen fachlichen Ort an, in dem du danach Karteikarten erstellst.</p>
        <form class="dialog-form" @submit.prevent="createCollection">
          <UFormField class="dialog-field" label="Name"><UInput v-model="newName" placeholder="z. B. Strafrecht AT" autofocus /></UFormField>
          <UFormField class="dialog-field" label="Rechtsgebiet"><UInput v-model="newSubject" placeholder="z. B. Strafrecht" /></UFormField>
          <div class="dialog-actions">
            <UButton type="button" color="neutral" variant="outline" @click="cancelCreateCollection">Abbrechen</UButton>
            <UButton type="submit" :disabled="!newName.trim()">Sammlung speichern</UButton>
          </div>
        </form>
      </div>
      </template>
    </UModal>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Clock3, Download, FolderKanban, FolderOpen, Layers, Play, Plus, Upload } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api'
import AppBreadcrumb from '../components/ui/AppBreadcrumb.vue'
import type { AppBreadcrumbItem } from '../ui/breadcrumbs'
import { STUDY_CATALOG_PAGE_SIZE } from '@shared/flashcardStudy'
import { studyProgress } from '@shared/studyCatalog'
import { collectionEntry, recommendationEntry } from '../ui/studyCatalogNavigation'
import { createStudyCatalogLoader } from '../ui/studyCatalogLoader'

const route = useRoute()
const router = useRouter()
const search = ref('')
const page = ref(1)
const loader = createStudyCatalogLoader(async (search, page) => {
  const response = await api.studyFlashcards({ action: 'catalog', search, page })
  if (!response.catalog) throw new Error('Sammlungsübersicht fehlt.')
  return response.catalog
})
const { catalog, loading, error: loadError } = loader
const collections = computed(() => catalog.value?.items ?? [])
const recommendation = computed(() => catalog.value?.recommendation ?? null)
const recommendedAction = computed(() => recommendation.value ? recommendationEntry(recommendation.value) : null)
const pageCount = computed(() => Math.max(1, Math.ceil((catalog.value?.total ?? 0) / STUDY_CATALOG_PAGE_SIZE)))
watch(search, () => { page.value = 1; loader.request(search.value, 1, 250) }, { flush: 'sync' })
onBeforeUnmount(loader.dispose)
const newName = ref('')
const newSubject = ref('')
const importControl = ref<HTMLElement | null>(null)
const transferMessage = ref('')
const transferMessageKind = ref<'info' | 'error'>('info')
const showImportPrompt = ref(false)
const showCreateCollectionDialog = ref(false)
const breadcrumbItems: AppBreadcrumbItem[] = [
  { label: 'Home', to: { name: 'home' } },
  { label: 'Karteikarten', to: { name: 'flashcards' } },
  { label: 'Sammlungen' }
]

onMounted(async () => {
  await load()
  if (route.query.import === '1') {
    showImportPrompt.value = true
    transferMessageKind.value = 'info'
    transferMessage.value = 'Bereit zum Übernehmen deiner Karteikarten. Wähle jetzt die passende Datei aus.'
    await router.replace({ name: 'flashcards-collections' })
  }
})

async function load(): Promise<void> {
  await loader.request(search.value, page.value)
}

function resetSearch(): void { search.value = ''; page.value = 1; void load() }
function changePage(next: number): void { page.value = next; void load() }

function triggerImport(): void {
  showImportPrompt.value = false
  transferMessage.value = ''
  importControl.value?.querySelector('input')?.click()
}

async function exportDecks(): Promise<void> {
  const json = await api.exportLearningDecksJson()
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `jura-wolpertinger-karteikarten-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
  transferMessageKind.value = 'info'
  transferMessage.value = 'Deine Karteikarten-Datei wurde erstellt.'
}

async function importDecks(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const result = await api.importLearningDecksJson(await file.text())
    transferMessageKind.value = 'info'
    transferMessage.value = `${result.cardsImported} Karten importiert, ${result.cardsSkipped} bereits vorhanden.`
    await load()
  } catch {
    transferMessageKind.value = 'error'
    transferMessage.value = 'Die Datei konnte nicht gelesen werden. Bitte wähle eine Karteikarten-Datei aus Jura Wolpertinger.'
  }
}

function openCreateCollectionDialog(): void {
  newName.value = ''
  newSubject.value = ''
  showCreateCollectionDialog.value = true
}

function cancelCreateCollection(): void {
  showCreateCollectionDialog.value = false
}

async function createCollection(): Promise<void> {
  if (!newName.value.trim()) return
  const collection = await api.createLearningCollection({
    name: newName.value,
    subject: newSubject.value || null
  })
  showCreateCollectionDialog.value = false
  await load()
  await router.push({ name: 'flashcards-collection', params: { id: collection.id } })
}
</script>

<style scoped>
.page-header > div > p:not(.eyebrow) { color: var(--color-text); }
.study-recommendation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 24px;
  border: 1px solid var(--color-border-strong);
  border-left: 4px solid var(--color-primary);
  border-radius: 10px;
  background: var(--color-surface);
}
.study-recommendation-copy { min-width: 0; }
.study-recommendation h2 { margin: 4px 0 16px; font-size: 22px; }
.study-recommendation h3 { margin: 4px 0 8px; font-size: 18px; overflow-wrap: anywhere; }
.study-recommendation p { margin: 0; }
.study-recommendation-subject { color: var(--color-text-muted); font-size: 13px; }
.study-recommendation-action { flex-shrink: 0; justify-content: center; }
.collection-search { display: flex; flex-wrap: wrap; align-items: end; gap: 12px 18px; margin-block: 24px 16px; }
.collection-search-field { flex: 1 1 280px; max-width: 560px; }
.collection-search-field :deep([data-slot='root']) { width: 100%; }
.collection-result-count { margin: 0 0 8px auto; color: var(--color-text); font-size: 14px; }
.collection-card { padding: 0; min-height: 0; }
.collection-card :deep([data-slot='body']) { display: flex; flex-direction: column; height: 100%; gap: 14px; padding: 20px; }
.collection-card-title h2 { min-height: 2.5em; }
.collection-stats { gap: 8px; }
.collection-stats span { flex-wrap: wrap; }
.collection-review-hint { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; min-height: 20px; font-size: 13px; color: var(--color-text-muted); }
.collection-review-hint a { padding: 0; }
.collection-card-actions { margin-top: auto; gap: 10px; }
.collection-card-actions :deep(a), .collection-card-actions :deep(button) { white-space: normal; text-align: center; min-height: 44px; height: 100%; }
.collection-progress { border-top: 1px solid var(--color-border); padding-top: 14px; }
.collection-progress-caption { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; font-size: 12px; line-height: 1.4; }
.collection-progress-caption strong { white-space: nowrap; color: var(--color-text); }
.collection-progress-track { margin-top: 8px; height: 7px; border-radius: 99px; overflow: hidden; background: var(--color-border-strong); }
.collection-progress-track > span { display: block; height: 100%; border-radius: inherit; background: var(--color-primary); }
:global(:root[data-theme='dark'] .collection-progress-track > span) { background: #7dd3fc; }
.collection-progress p { margin: 0; font-size: 13px; color: var(--color-text-muted); }
.collection-loading, .collection-empty { padding: 32px 16px; text-align: center; color: var(--color-text); }
.collection-empty h2 { font-size: 18px; color: var(--color-text); }
.collection-pagination { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 16px; margin-top: 24px; }
@media (max-width: 700px) {
  .study-recommendation { align-items: stretch; flex-direction: column; gap: 18px; padding: 20px; }
  .collection-search-field { flex-basis: 100%; max-width: none; }
  .collection-result-count { margin: 0; }
  .collection-pagination { gap: 10px; }
  .collection-pagination span { order: -1; flex-basis: 100%; text-align: center; }
}
</style>
