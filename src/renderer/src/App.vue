<template>
  <UApp>
  <section v-if="cloudAuth.status !== 'not_required' && cloudAuth.status !== 'signed_in'" class="auth-gate">
    <div class="auth-panel">
      <div class="auth-brand">
        <img :src="welcomeImageUrl" alt="" />
        <div>
          <p class="eyebrow">Jura Wolpertinger</p>
          <h1>{{ authTitle }}</h1>
        </div>
      </div>
      <p class="auth-copy">{{ authCopy }}</p>
      <div
        v-if="cloudAuth.status !== 'missing_config'"
        class="auth-mode-switch"
        aria-label="Anmeldung oder Registrierung auswählen"
      >
        <button
          type="button"
          :class="{ active: authMode === 'sign_in' }"
          :aria-pressed="authMode === 'sign_in'"
          @click="setAuthMode('sign_in')"
        >
          Einloggen
        </button>
        <button
          type="button"
          :class="{ active: authMode === 'sign_up' }"
          :aria-pressed="authMode === 'sign_up'"
          @click="setAuthMode('sign_up')"
        >
          Account erstellen
        </button>
      </div>
      <form v-if="cloudAuth.status !== 'missing_config'" class="auth-form" @submit.prevent="submitAuthForm">
        <label class="form-field">
          E-Mail
          <input v-model="authEmail" type="email" autocomplete="email" required />
        </label>
        <label class="form-field">
          Passwort
          <input
            v-model="authPassword"
            type="password"
            :autocomplete="authMode === 'sign_up' ? 'new-password' : 'current-password'"
            required
          />
        </label>
        <p class="auth-action-hint">{{ authActionHint }}</p>
        <p v-if="authMessage" class="auth-message" :class="{ error: authMessageKind === 'error' }">
          {{ authMessage }}
        </p>
        <div class="auth-actions">
          <button type="submit" :disabled="authBusy">{{ authSubmitLabel }}</button>
        </div>
        <p class="auth-switch-copy">
          {{ authSwitchText }}
          <button type="button" class="link-button" :disabled="authBusy" @click="toggleAuthMode">
            {{ authSwitchLabel }}
          </button>
        </p>
      </form>
      <p v-else class="auth-message error">{{ cloudAuth.error }}</p>
    </div>
  </section>

  <div v-else class="app-shell" :class="{ 'exam-shell': isExamFocus }">
    <aside v-if="!isExamFocus" class="sidebar">
      <div class="beta-banner" aria-label="Beta-Version">BETA</div>
        <RouterLink class="brand" to="/">
        <img :src="iconUrl" alt="" />
        <span>Jura Wolpertinger</span>
      </RouterLink>
      <nav class="nav">
        <RouterLink to="/">
          <House :size="18" aria-hidden="true" />
          <span>Home</span>
        </RouterLink>
        <p class="nav-section">Karteikarten</p>
        <RouterLink :to="{ name: 'flashcards-review' }">
          <Layers :size="18" aria-hidden="true" />
          <span>Wiederholen</span>
        </RouterLink>
        <RouterLink :to="{ name: 'flashcards-collections' }">
          <FolderKanban :size="18" aria-hidden="true" />
          <span>Sammlungen</span>
        </RouterLink>
        <p class="nav-section">Prüfungen</p>
        <RouterLink :to="{ name: 'dashboard' }">
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
        <RouterLink :to="{ name: 'settings' }">
          <Settings :size="18" aria-hidden="true" />
          <span>Einstellungen</span>
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
    <nav v-if="!isExamFocus" class="mobile-nav" aria-label="Hauptnavigation">
      <RouterLink to="/">
        <House :size="18" aria-hidden="true" />
        <span>Home</span>
      </RouterLink>
      <RouterLink :to="{ name: 'flashcards' }">
        <Layers :size="18" aria-hidden="true" />
        <span>Karteikarten</span>
      </RouterLink>
      <RouterLink :to="{ name: 'exams' }">
        <LibraryBig :size="18" aria-hidden="true" />
        <span>Prüfungen</span>
      </RouterLink>
      <RouterLink :to="{ name: 'more' }">
        <Ellipsis :size="18" aria-hidden="true" />
        <span>Mehr</span>
      </RouterLink>
    </nav>
    <main class="main-pane">
      <RouterView />
    </main>

    <div v-if="showTourPrompt" class="modal-backdrop" role="presentation">
      <section class="modal-card onboarding-card" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <div class="onboarding-heading">
          <img class="onboarding-image" :src="welcomeImageUrl" alt="" />
          <div>
            <p class="eyebrow">Erste Schritte</p>
            <h2 id="onboarding-title">Was möchtest du als Nächstes tun?</h2>
            <p>
              Wähle einen Einstieg oder starte direkt. Du kannst alles später in den Einstellungen ändern.
            </p>
          </div>
        </div>
        <div class="onboarding-actions" aria-label="Onboarding Aktionen">
          <button type="button" class="onboarding-action-card" @click="openOnboardingTarget('flashcards')">
            <Layers :size="20" aria-hidden="true" />
            <span>Karteikarten lernen</span>
            <small>Wiederholen oder Sammlungen öffnen.</small>
          </button>
          <button type="button" class="onboarding-action-card" @click="openOnboardingTarget('exam')">
            <LibraryBig :size="20" aria-hidden="true" />
            <span>Klausur schreiben</span>
            <small>Prüfungsbibliothek und Schreibmodus.</small>
          </button>
          <button type="button" class="onboarding-action-card" @click="openOnboardingTarget('import')">
            <FolderKanban :size="20" aria-hidden="true" />
            <span>Daten importieren</span>
            <small>Vorhandene Karteikarten aus einer Datei übernehmen.</small>
          </button>
          <button type="button" class="onboarding-action-card" @click="openOnboardingTarget('settings')">
            <Settings :size="20" aria-hidden="true" />
            <span>{{ onboardingSettingsTitle }}</span>
            <small>{{ onboardingSettingsCopy }}</small>
          </button>
        </div>
        <div class="modal-actions">
          <button class="secondary" @click="showTourPrompt = false">Direkt zur App</button>
          <button @click="skipOnboarding">Nicht mehr anzeigen</button>
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
  </UApp>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ChartNoAxesCombined,
  CircleHelp,
  ClipboardCheck,
  Ellipsis,
  FolderKanban,
  House,
  Info,
  Layers,
  LibraryBig,
  Moon,
  Route,
  Settings,
  Sun,
  UserPlus
} from 'lucide-vue-next'
import type { AppUser } from '@shared/ipc'
import { APP_VERSION } from '@shared/constants'
import { api, isElectronApiAvailable } from './api'
import { getSupabaseAuthClient, readCloudAuthState, requiresCloudAuth, type CloudAuthState } from './cloudAuth'
import { startOnboardingTour } from './onboarding'
import { useTheme } from './theme'

const route = useRoute()
const router = useRouter()
const isExamFocus = computed(() => route.name === 'exam-focus')
const iconUrl = 'assets/icon.png'
const welcomeImageUrl = 'assets/hello.png'
const appVersion = APP_VERSION
const { isDark, toggleTheme, applyTheme } = useTheme()
const users = ref<AppUser[]>([])
const currentUser = ref<AppUser | null>(null)
const showTourPrompt = ref(false)
const showCreateUser = ref(false)
const newUserName = ref('')
const cloudAuth = ref<CloudAuthState>(
  requiresCloudAuth()
    ? { status: 'loading', session: null, error: null }
    : { status: 'not_required', session: null, error: null }
)
const authEmail = ref('')
const authPassword = ref('')
const authBusy = ref(false)
const authMessage = ref('')
const authMessageKind = ref<'info' | 'error'>('info')
const authMode = ref<'sign_in' | 'sign_up'>('sign_in')
const authTitle = computed(() =>
  authMode.value === 'sign_up' ? 'Kostenlosen Account erstellen' : 'Einloggen'
)
const authCopy = computed(() =>
  authMode.value === 'sign_up'
    ? 'Erstelle deinen kostenlosen Account. Wenn alles passt, wirst du direkt angemeldet.'
    : 'Melde dich an, um deine Lern- und Prüfungsdaten zu öffnen.'
)
const authActionHint = computed(() =>
  authMode.value === 'sign_up'
    ? 'Mit dem Button unten wird der Account sofort erstellt.'
    : 'Mit dem Button unten wirst du direkt angemeldet.'
)
const authSubmitLabel = computed(() => {
  if (authBusy.value) return 'Bitte warten'
  return authMode.value === 'sign_up' ? 'Account jetzt erstellen' : 'Jetzt einloggen'
})
const authSwitchText = computed(() =>
  authMode.value === 'sign_up' ? 'Du hast schon einen Account?' : 'Noch kein Account?'
)
const authSwitchLabel = computed(() =>
  authMode.value === 'sign_up' ? 'Einloggen' : 'Kostenlos erstellen'
)
const onboardingSettingsTitle = computed(() => (isElectronApiAvailable ? 'Cloud verbinden' : 'Einstellungen prüfen'))
const onboardingSettingsCopy = computed(() =>
  isElectronApiAvailable
    ? 'Optional synchronisieren. Lokal bleibt alles nutzbar.'
    : 'Account, App-Status und Optionen prüfen.'
)
const startTourListener = () => startTour()
const usersUpdatedListener = () => {
  void loadUsers()
}

onMounted(async () => {
  applyTheme()
  cloudAuth.value = await readCloudAuthState()
  getSupabaseAuthClient()?.auth.onAuthStateChange((_event, session) => {
    cloudAuth.value = session
      ? { status: 'signed_in', session, error: null }
      : { status: 'signed_out', session: null, error: null }
    if (session) void loadUsers()
  })
  if (cloudAuth.value.status === 'not_required' || cloudAuth.value.status === 'signed_in') {
    await loadUsers()
  }
  window.addEventListener('jura:start-tour', startTourListener)
  window.addEventListener('jura:users-updated', usersUpdatedListener)
})

onBeforeUnmount(() => {
  window.removeEventListener('jura:start-tour', startTourListener)
  window.removeEventListener('jura:users-updated', usersUpdatedListener)
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

async function openOnboardingTarget(target: 'flashcards' | 'exam' | 'import' | 'settings'): Promise<void> {
  showTourPrompt.value = false
  if (currentUser.value) {
    currentUser.value = await api.completeOnboarding(currentUser.value.id)
  }
  if (target === 'flashcards') {
    const dashboard = await api.getLearningDashboard()
    await router.push({ name: dashboard.dueCount > 0 ? 'flashcards-review' : 'flashcards-collections' })
    return
  }
  if (target === 'exam') {
    await router.push({ name: 'dashboard' })
    return
  }
  if (target === 'import') {
    await router.push({ name: 'flashcards-collections', query: { import: '1' } })
    return
  }
  await router.push({ name: 'settings' })
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

function setAuthMode(mode: 'sign_in' | 'sign_up'): void {
  authMode.value = mode
  authMessage.value = ''
}

function toggleAuthMode(): void {
  setAuthMode(authMode.value === 'sign_up' ? 'sign_in' : 'sign_up')
}

async function submitAuthForm(): Promise<void> {
  if (authMode.value === 'sign_up') {
    await registerAuth()
    return
  }
  await submitAuth()
}

async function submitAuth(): Promise<void> {
  const client = getSupabaseAuthClient()
  if (!client) return
  authBusy.value = true
  authMessage.value = ''
  const { error } = await client.auth.signInWithPassword({
    email: authEmail.value.trim(),
    password: authPassword.value
  })
  authBusy.value = false
  if (error) {
    authMessageKind.value = 'error'
    authMessage.value = 'Einloggen fehlgeschlagen. Bitte E-Mail und Passwort prüfen.'
    return
  }
  authMessageKind.value = 'info'
  authMessage.value = ''
  cloudAuth.value = await readCloudAuthState()
  await loadUsers()
}

async function registerAuth(): Promise<void> {
  const client = getSupabaseAuthClient()
  if (!client) return
  authBusy.value = true
  authMessage.value = ''
  const { error } = await client.auth.signUp({
    email: authEmail.value.trim(),
    password: authPassword.value
  })
  authBusy.value = false
  if (error) {
    authMessageKind.value = 'error'
    authMessage.value = 'Registrierung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.'
    return
  }
  authMessageKind.value = 'info'
  authMessage.value = 'Account erstellt. Falls keine direkte Anmeldung erfolgt, bitte dein Postfach prüfen.'
  cloudAuth.value = await readCloudAuthState()
  if (cloudAuth.value.status === 'signed_in') {
    await loadUsers()
  }
}
</script>
