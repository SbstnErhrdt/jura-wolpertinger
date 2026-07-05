<template>
  <section class="page flashcards-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">Karteikarten</p>
        <h1>Sammlungen</h1>
        <p>Collections sind deine fachlichen Kartensätze. Tags helfen beim gezielten Wiederholen.</p>
      </div>
      <button @click="seedDecks">Seed-Decks importieren</button>
    </header>

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
import type { LearningCollection } from '@shared/schemas'
import { api } from '../api'

const collections = ref<LearningCollection[]>([])
const newName = ref('')
const newSubject = ref('')

onMounted(load)

async function load(): Promise<void> {
  collections.value = await api.listLearningCollections()
}

async function seedDecks(): Promise<void> {
  collections.value = await api.seedLearningDecks()
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
