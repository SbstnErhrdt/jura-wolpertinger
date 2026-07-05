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
        <button type="button" @click="openCreateCollectionDialog">
          <Plus :size="17" aria-hidden="true" />
          Neue Sammlung
        </button>
        <button class="secondary" type="button" @click="triggerImport">
          <Upload :size="17" aria-hidden="true" />
          Datei auswählen
        </button>
        <button class="secondary" type="button" @click="exportDecks">
          <Download :size="17" aria-hidden="true" />
          Karten sichern
        </button>
      </div>
    </header>

    <input
      ref="importInput"
      class="visually-hidden"
      type="file"
      accept="application/json,.json"
      @change="importDecks"
    />
    <div v-if="transferMessage" class="action-notice" :class="{ error: transferMessageKind === 'error' }">
      <span>{{ transferMessage }}</span>
      <button v-if="showImportPrompt" class="secondary" type="button" @click="triggerImport">
        Karteikarten-Datei auswählen
      </button>
    </div>

    <div class="collection-grid">
      <article v-for="collection in collections" :key="collection.id" class="collection-card">
        <h2>{{ collection.name }}</h2>
        <p>{{ collection.subject || 'Allgemein' }}</p>
        <div class="collection-stats">
          <span>{{ collection.cardCount }} Karten</span>
          <span>{{ collection.dueCount }} fällig</span>
        </div>
        <div class="collection-card-actions">
          <RouterLink class="secondary" :to="{ name: 'flashcards-collection', params: { id: collection.id } }">
            Öffnen
          </RouterLink>
          <RouterLink class="secondary" :to="{ name: 'flashcards-review', query: { collection: collection.id } }">
            Wiederholen
          </RouterLink>
        </div>
      </article>
    </div>

    <div v-if="showCreateCollectionDialog" class="dialog-backdrop" @click="cancelCreateCollection">
      <div class="dialog-card" @click.stop>
        <h2>Neue Sammlung</h2>
        <p class="dialog-copy">Lege einen fachlichen Ort an, in dem du danach Karteikarten erstellst.</p>
        <form class="dialog-form" @submit.prevent="createCollection">
          <label class="dialog-field">
            Name
            <input v-model="newName" placeholder="z. B. Strafrecht AT" autofocus />
          </label>
          <label class="dialog-field">
            Rechtsgebiet
            <input v-model="newSubject" placeholder="z. B. Strafrecht" />
          </label>
          <div class="dialog-actions">
            <button type="button" class="secondary" @click="cancelCreateCollection">Abbrechen</button>
            <button type="submit" :disabled="!newName.trim()">Sammlung speichern</button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Download, Plus, Upload } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import type { LearningCollection } from '@shared/schemas'
import { api } from '../api'
import AppBreadcrumb, { type BreadcrumbItem } from '../components/ui/AppBreadcrumb.vue'

const route = useRoute()
const router = useRouter()
const collections = ref<LearningCollection[]>([])
const newName = ref('')
const newSubject = ref('')
const importInput = ref<HTMLInputElement | null>(null)
const transferMessage = ref('')
const transferMessageKind = ref<'info' | 'error'>('info')
const showImportPrompt = ref(false)
const showCreateCollectionDialog = ref(false)
const breadcrumbItems: BreadcrumbItem[] = [
  { label: 'Home', to: { name: 'home' } },
  { label: 'Karteikarten' },
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
  collections.value = await api.listLearningCollections()
}

function triggerImport(): void {
  showImportPrompt.value = false
  transferMessage.value = ''
  importInput.value?.click()
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
