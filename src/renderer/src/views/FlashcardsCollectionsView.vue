<template>
  <section class="page flashcards-page">
    <header class="page-header">
      <div>
        <UBreadcrumb class="app-breadcrumb" :items="withHomeIcon(breadcrumbItems)" />
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

    <div class="collection-grid">
      <UCard v-for="collection in collections" :key="collection.id" class="collection-card">
        <h2>{{ collection.name }}</h2>
        <p>{{ collection.subject || 'Allgemein' }}</p>
        <div class="collection-stats">
          <span>{{ collection.cardCount }} Karten</span>
          <span>{{ collection.dueCount }} fällig</span>
        </div>
        <div class="collection-card-actions">
          <UButton color="neutral" variant="outline" :to="{ name: 'flashcards-collection', params: { id: collection.id } }">
            Öffnen
          </UButton>
          <UButton color="neutral" variant="outline" :to="{ name: 'flashcards-review', query: { collection: collection.id } }">
            Wiederholen
          </UButton>
        </div>
      </UCard>
    </div>

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
import { onMounted, ref } from 'vue'
import { Download, Plus, Upload } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import type { LearningCollection } from '@shared/schemas'
import { api } from '../api'
import { type AppBreadcrumbItem, withHomeIcon } from '../ui/breadcrumbs'

const route = useRoute()
const router = useRouter()
const collections = ref<LearningCollection[]>([])
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
  collections.value = await api.listLearningCollections()
}

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
