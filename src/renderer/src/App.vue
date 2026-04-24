<template>
  <div class="app-shell" :class="{ 'exam-shell': isExamFocus }">
    <aside v-if="!isExamFocus" class="sidebar">
      <RouterLink class="brand" to="/">
        <img :src="iconUrl" alt="" />
        <span>Jura Wolpertinger</span>
      </RouterLink>
      <nav class="nav">
        <RouterLink to="/">
          <LibraryBig :size="18" aria-hidden="true" />
          <span>Bibliothek</span>
        </RouterLink>
        <RouterLink :to="{ name: 'correction' }">
          <ClipboardCheck :size="18" aria-hidden="true" />
          <span>Bewertung</span>
        </RouterLink>
        <RouterLink :to="{ name: 'analytics' }">
          <ChartNoAxesCombined :size="18" aria-hidden="true" />
          <span>Auswertung</span>
        </RouterLink>
        <RouterLink :to="{ name: 'about' }">
          <Info :size="18" aria-hidden="true" />
          <span>About</span>
        </RouterLink>
        <RouterLink :to="{ name: 'help' }">
          <CircleHelp :size="18" aria-hidden="true" />
          <span>Hilfe</span>
        </RouterLink>
      </nav>
      <div class="sidebar-footer">
        <section class="sidebar-user" aria-label="Nutzer">
          <label for="user-switcher">Nutzer</label>
          <select id="user-switcher" :value="currentUser?.id" @change="switchUser">
            <option v-for="user in users" :key="user.id" :value="user.id">
              {{ user.displayName }}{{ user.kind === 'demo' ? ' · Demo' : '' }}
            </option>
          </select>
          <button class="sidebar-small-button" @click="showCreateUser = true">
            <UserPlus :size="15" />
            Neuer Nutzer
          </button>
          <button class="sidebar-small-button" @click="startTour">
            <Route :size="15" />
            Tour
          </button>
        </section>
        <button
          class="sidebar-theme-toggle"
          :title="isDark ? 'Hellmodus' : 'Dunkelmodus'"
          @click="toggleTheme"
        >
          <span class="theme-toggle-option" :class="{ active: !isDark }">
            <Sun :size="17" />
          </span>
          <span class="theme-toggle-option" :class="{ active: isDark }">
            <Moon :size="17" />
          </span>
        </button>
        <span class="sidebar-version">Version {{ appVersion }}</span>
      </div>
    </aside>
    <main class="main-pane">
      <RouterView />
    </main>

    <div v-if="showTourPrompt" class="modal-backdrop" role="presentation">
      <section class="modal-card onboarding-card" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <img class="onboarding-image" :src="welcomeImageUrl" alt="" />
        <p class="eyebrow">Erste Schritte</p>
        <h2 id="onboarding-title">Willkommen in Jura Wolpertinger</h2>
        <p>
          Die App ist offline-ready und speichert deine Klausuren lokal pro Nutzer. Die Tour zeigt dir
          Bibliothek, Bewertung, Tagging und Auswertung in wenigen Schritten.
        </p>
        <div class="modal-actions">
          <button class="secondary" @click="skipOnboarding">Später</button>
          <button @click="startTour">Tour starten</button>
        </div>
      </section>
    </div>

    <div v-if="showCreateUser" class="modal-backdrop" role="presentation">
      <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="create-user-title">
        <h2 id="create-user-title">Neuer lokaler Nutzer</h2>
        <p>
          Lege einen eigenen Arbeitsbereich an. Klausuren, Bewertungen und Einstellungen bleiben
          getrennt und können später bei Bedarf übernommen werden.
        </p>
        <label class="form-field">
          Name
          <input v-model="newUserName" autofocus placeholder="z. B. Sebastian" @keyup.enter="createUser" />
        </label>
        <div class="modal-actions">
          <button class="secondary" @click="showCreateUser = false">Abbrechen</button>
          <button :disabled="!newUserName.trim()" @click="createUser">Erstellen</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ChartNoAxesCombined,
  CircleHelp,
  ClipboardCheck,
  Info,
  LibraryBig,
  Moon,
  Route,
  Sun,
  UserPlus
} from 'lucide-vue-next'
import type { AppUser } from '@shared/ipc'
import { api } from './api'
import { startOnboardingTour } from './onboarding'
import { useTheme } from './theme'

const route = useRoute()
const router = useRouter()
const isExamFocus = computed(() => route.name === 'exam-focus')
const iconUrl = 'assets/icon.png'
const welcomeImageUrl = 'assets/hello.png'
const appVersion = import.meta.env.PACKAGE_VERSION
const { isDark, toggleTheme, applyTheme } = useTheme()
const users = ref<AppUser[]>([])
const currentUser = ref<AppUser | null>(null)
const showTourPrompt = ref(false)
const showCreateUser = ref(false)
const newUserName = ref('')
const startTourListener = () => startTour()

onMounted(async () => {
  applyTheme()
  await loadUsers()
  window.addEventListener('jura:start-tour', startTourListener)
})

onBeforeUnmount(() => {
  window.removeEventListener('jura:start-tour', startTourListener)
})

async function loadUsers(): Promise<void> {
  currentUser.value = await api.getCurrentUser()
  users.value = await api.listUsers()
  showTourPrompt.value = !currentUser.value.onboardingCompletedAt
}

async function switchUser(event: Event): Promise<void> {
  const userId = (event.target as HTMLSelectElement).value
  currentUser.value = await api.switchUser(userId)
  showTourPrompt.value = !currentUser.value.onboardingCompletedAt
  window.location.reload()
}

async function createUser(): Promise<void> {
  const name = newUserName.value.trim()
  if (!name) return
  currentUser.value = await api.createUser(name)
  users.value = await api.listUsers()
  newUserName.value = ''
  showCreateUser.value = false
  showTourPrompt.value = true
  window.location.reload()
}

async function skipOnboarding(): Promise<void> {
  if (!currentUser.value) return
  currentUser.value = await api.completeOnboarding(currentUser.value.id)
  showTourPrompt.value = false
}

async function startTour(): Promise<void> {
  showTourPrompt.value = false
  if (route.name !== 'dashboard') {
    await router.push({ name: 'dashboard' })
    await nextTick()
  }
  startOnboardingTour(async () => {
    if (!currentUser.value) return
    currentUser.value = await api.completeTour(currentUser.value.id)
    currentUser.value = await api.completeOnboarding(currentUser.value.id)
  })
}
</script>
