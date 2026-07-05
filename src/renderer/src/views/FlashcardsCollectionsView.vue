<template>
  <section class="page flashcards-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">Karteikarten</p>
        <h1>Sammlungen</h1>
        <p>Sammlungen sind deine fachlichen Kartensätze. JSON-Import und Export bleiben lokal und portabel.</p>
      </div>
      <div class="header-actions">
        <button class="secondary" type="button" @click="triggerImport">JSON importieren</button>
        <button type="button" @click="exportDecks">JSON exportieren</button>
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
      <button v-if="showImportPrompt" class="secondary" type="button" @click="triggerImport">JSON importieren</button>
    </div>

    <form class="collection-form" @submit.prevent="createCollection">
      <input v-model="newName" placeholder="Neue Sammlung, z. B. Strafrecht AT" />
      <input v-model="newSubject" placeholder="Rechtsgebiet" />
      <button :disabled="!newName.trim()">Anlegen</button>
    </form>

    <div class="collection-grid">
      <article v-for="collection in collections" :key="collection.id" class="collection-card">
        <h2>{{ collection.name }}</h2>
        <p>{{ collection.subject || 'Allgemein' }}</p>
        <div class="collection-stats">
          <span>{{ collection.cardCount }} Karten</span>
          <span>{{ collection.dueCount }} fällig</span>
        </div>
        <RouterLink class="secondary" :to="{ name: 'flashcards-review', query: { collection: collection.id } }">
          Wiederholen
        </RouterLink>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { LearningCollection } from '@shared/schemas'
import { api } from '../api'

const route = useRoute()
const router = useRouter()
const collections = ref<LearningCollection[]>([])
const newName = ref('')
const newSubject = ref('')
const importInput = ref<HTMLInputElement | null>(null)
const transferMessage = ref('')
const transferMessageKind = ref<'info' | 'error'>('info')
const showImportPrompt = ref(false)

onMounted(async () => {
  await load()
  if (route.query.import === '1') {
    showImportPrompt.value = true
    transferMessageKind.value = 'info'
    transferMessage.value = 'Bereit für den JSON-Import. Wähle jetzt deine Karteikarten-Datei aus.'
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
  transferMessage.value = 'JSON-Export wurde erstellt.'
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
    transferMessage.value = 'Import fehlgeschlagen. Bitte eine gültige Jura-Wolpertinger-JSON-Datei auswählen.'
  }
}

async function createCollection(): Promise<void> {
  if (!newName.value.trim()) return
  await api.createLearningCollection({
    name: newName.value,
    subject: newSubject.value || null
  })
  newName.value = ''
  newSubject.value = ''
  await load()
}
</script>
