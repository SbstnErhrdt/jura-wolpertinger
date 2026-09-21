<template>
  <section class="home-view">
    <UCard v-if="profilePromptVisible" class="profile-completion-card">
      <div class="profile-completion-copy">
        <span class="eyebrow">Profil</span>
        <h2>Wie dürfen wir dich ansprechen?</h2>
        <p>Ergänze deinen Namen, damit Wolpi dich beim Lernen persönlich begrüßen kann.</p>
      </div>
      <UButton type="button" icon="i-lucide-user-round-check" @click="openProfileModal">
        Profil vervollständigen
      </UButton>
    </UCard>

    <div class="home-hero">
      <div>
        <p class="eyebrow">Heute</p>
        <h1>Bereit für deine nächste Einheit?</h1>
        <p>
          Kleine, echte Lerneinheiten zählen: Karteikarten wiederholen oder eine Prüfung schreiben.
        </p>
        <div class="home-actions">
          <UButton class="primary-action" size="lg" :to="continueTarget">
            {{ continueLabel }}
          </UButton>
          <UButton color="neutral" variant="outline" size="lg" :to="{ name: 'dashboard' }">
            Prüfung schreiben
          </UButton>
        </div>
      </div>
      <img :src="helloUrl" alt="" />
    </div>

    <AppLoadingState label="Startseite wird geladen" v-if="loading">
      <div class="home-metrics home-metrics-skeleton">
        <UCard v-for="index in 3" :key="index">
          <USkeleton class="home-metric-value-skeleton" />
          <USkeleton class="home-metric-label-skeleton" />
          <USkeleton class="home-metric-copy-skeleton" />
        </UCard>
      </div>
    </AppLoadingState>
    <UAlert v-else-if="loadError" color="error" :description="loadError">
      <template #actions>
        <UButton type="button" color="neutral" variant="outline" @click="loadHome">Erneut versuchen</UButton>
      </template>
    </UAlert>
    <div v-else-if="dashboard" class="home-metrics">
      <UCard>
        <span>{{ dashboard.streakDays }}</span>
        <strong>Tage Streak</strong>
        <small>{{ dashboard.freeDaysRemainingThisWeek }} freie Tage diese Woche übrig</small>
      </UCard>
      <UCard>
        <span>{{ dashboard.dueCount }}</span>
        <strong>Wiederholungen empfohlen</strong>
        <small>{{ dashboard.totalCards }} Karten insgesamt</small>
      </UCard>
      <UCard>
        <span>{{ dashboard.collectionCount }}</span>
        <strong>Sammlungen</strong>
        <small>{{ dashboard.learnedToday ? 'Heute gelernt' : 'Heute noch offen' }}</small>
      </UCard>
    </div>

    <UModal :open="showProfileModal" @update:open="showProfileModal = $event">
      <template #content>
        <form class="modal-card" aria-labelledby="profile-modal-title" @submit.prevent="saveProfile">
          <h2 id="profile-modal-title">Profil vervollständigen</h2>
          <p>Dein Name wird nur für die persönliche Ansprache in Jura Wolpertinger genutzt.</p>
          <UFormField label="Vorname" required>
            <UInput v-model="profileFirstName" autocomplete="given-name" required />
          </UFormField>
          <UFormField label="Nachname">
            <UInput v-model="profileLastName" autocomplete="family-name" />
          </UFormField>
          <p v-if="profileError" class="form-error">{{ profileError }}</p>
          <div class="modal-actions">
            <UButton type="button" color="neutral" variant="outline" :disabled="profileSaving" @click="showProfileModal = false">
              Später
            </UButton>
            <UButton type="submit" :loading="profileSaving" :disabled="!profileFirstName.trim()">
              Speichern
            </UButton>
          </div>
        </form>
      </template>
    </UModal>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { LearningDashboard, UserProfile } from '@shared/schemas'
import { api } from '../api'
import { requiresCloudAuth } from '../cloudAuth'
import type { StudyOverview } from '@shared/flashcardStudy'
import { studyEntry } from '../ui/studyNavigation'
import AppLoadingState from '../components/ui/AppLoadingState.vue'

const dashboard = ref<LearningDashboard | null>(null)
const loading = ref(true)
const loadError = ref('')
const studyOverviews = ref<StudyOverview[]>([])
const collectionNames = ref<Record<string, string>>({})
const lastStudy = computed(() => studyOverviews.value.filter((entry) => entry.activeRun).sort((a, b) => b.activeRun!.updatedAt.localeCompare(a.activeRun!.updatedAt))[0])
const continueTarget = computed(() => lastStudy.value ? { name: 'flashcards-review', query: studyEntry(lastStudy.value).query } : { name: 'flashcards-collections' })
const continueLabel = computed(() => lastStudy.value ? `${collectionNames.value[lastStudy.value.collectionId] ?? 'Sammlung'} · Durchgang fortsetzen` : 'Sammlung zum Lernen wählen')
const profile = ref<UserProfile | null>(null)
const showProfileModal = ref(false)
const profileFirstName = ref('')
const profileLastName = ref('')
const profileSaving = ref(false)
const profileError = ref('')
const helloUrl = 'assets/hello.png'

const profilePromptVisible = computed(() =>
  requiresCloudAuth() && profile.value !== null && !profile.value.firstName
)

onMounted(loadHome)

async function loadHome(): Promise<void> {
  loading.value = true
  loadError.value = ''
  try {
    const [nextDashboard, nextProfile] = await Promise.all([
      api.getLearningDashboard(),
      api.getUserProfile().catch(() => null)
    ])
    dashboard.value = nextDashboard
    profile.value = nextProfile
    const [studyResult, collections] = await Promise.all([
      api.studyFlashcards({ action: 'overview' }).catch(() => ({ overviews: [] })),
      api.listLearningCollections().catch(() => [])
    ])
    studyOverviews.value = studyResult.overviews
    collectionNames.value = Object.fromEntries(collections.map((collection) => [collection.id, collection.name]))
    if (studyResult.overviews.length) dashboard.value.dueCount = studyResult.overviews.reduce((total, entry) => total + entry.dueCards, 0)
    profileFirstName.value = nextProfile?.firstName ?? ''
    profileLastName.value = nextProfile?.lastName ?? ''
  } catch {
    loadError.value = 'Die Startseite konnte nicht geladen werden.'
  } finally {
    loading.value = false
  }
}

function openProfileModal(): void {
  profileError.value = ''
  profileFirstName.value = profile.value?.firstName ?? ''
  profileLastName.value = profile.value?.lastName ?? ''
  showProfileModal.value = true
}

async function saveProfile(): Promise<void> {
  if (!profileFirstName.value.trim()) return
  profileSaving.value = true
  profileError.value = ''
  try {
    profile.value = await api.updateUserProfile({
      firstName: profileFirstName.value,
      lastName: profileLastName.value
    })
    showProfileModal.value = false
  } catch {
    profileError.value = 'Das Profil konnte nicht gespeichert werden. Bitte versuche es noch einmal.'
  } finally {
    profileSaving.value = false
  }
}
</script>
