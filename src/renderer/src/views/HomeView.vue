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
          <UButton class="primary-action" size="lg" :to="{ name: 'flashcards-review' }">
            Karteikarten wiederholen
          </UButton>
          <UButton color="neutral" variant="outline" size="lg" :to="{ name: 'dashboard' }">
            Prüfung schreiben
          </UButton>
        </div>
      </div>
      <img :src="helloUrl" alt="" />
    </div>

    <div class="home-metrics">
      <UCard>
        <span>{{ dashboard?.streakDays ?? 0 }}</span>
        <strong>Tage Streak</strong>
        <small>{{ dashboard?.freeDaysRemainingThisWeek ?? 2 }} freie Tage diese Woche übrig</small>
      </UCard>
      <UCard>
        <span>{{ dashboard?.dueCount ?? 0 }}</span>
        <strong>Karten fällig</strong>
        <small>{{ dashboard?.totalCards ?? 0 }} Karten insgesamt</small>
      </UCard>
      <UCard>
        <span>{{ dashboard?.collectionCount ?? 0 }}</span>
        <strong>Sammlungen</strong>
        <small>{{ dashboard?.learnedToday ? 'Heute gelernt' : 'Heute noch offen' }}</small>
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

const dashboard = ref<LearningDashboard | null>(null)
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

onMounted(async () => {
  const [nextDashboard, nextProfile] = await Promise.all([
    api.getLearningDashboard(),
    api.getUserProfile().catch(() => null)
  ])
  dashboard.value = nextDashboard
  profile.value = nextProfile
  profileFirstName.value = nextProfile?.firstName ?? ''
  profileLastName.value = nextProfile?.lastName ?? ''
})

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
