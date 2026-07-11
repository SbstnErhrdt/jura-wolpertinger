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
          <UButton
            type="button"
            label="Einloggen"
            :variant="authMode === 'sign_in' ? 'solid' : 'ghost'"
            :aria-pressed="authMode === 'sign_in'"
            @click="setAuthMode('sign_in')"
          />
          <UButton
            type="button"
            label="Account erstellen"
            :variant="authMode === 'sign_up' ? 'solid' : 'ghost'"
            :aria-pressed="authMode === 'sign_up'"
            @click="setAuthMode('sign_up')"
          />
        </div>
        <form v-if="cloudAuth.status !== 'missing_config'" class="auth-form" @submit.prevent="submitAuthForm">
          <UFormField label="E-Mail" class="form-field">
            <UInput v-model="authEmail" type="email" autocomplete="email" required />
          </UFormField>
          <UFormField label="Passwort" class="form-field">
            <UInput
              v-model="authPassword"
              type="password"
              :autocomplete="authMode === 'sign_up' ? 'new-password' : 'current-password'"
              required
            />
          </UFormField>
          <p class="auth-action-hint">{{ authActionHint }}</p>
          <UAlert
            v-if="authMessage"
            class="auth-message"
            :color="authMessageKind === 'error' ? 'error' : 'info'"
            :description="authMessage"
          />
          <div class="auth-actions">
            <UButton type="submit" :loading="authBusy" :label="authSubmitLabel" />
          </div>
          <p class="auth-switch-copy">
            {{ authSwitchText }}
            <UButton
              type="button"
              class="link-button"
              color="neutral"
              variant="link"
              :disabled="authBusy"
              :label="authSwitchLabel"
              @click="toggleAuthMode"
            />
          </p>
        </form>
        <UAlert v-else class="auth-message" color="error" :description="cloudAuth.error ?? ''" />
      </div>
    </section>

    <div v-else class="app-shell" :class="{ 'exam-shell': isExamFocus }">
      <aside v-if="!isExamFocus" class="sidebar">
        <div class="beta-banner" aria-label="Beta-Version">BETA</div>
        <RouterLink class="brand" to="/">
          <img :src="iconUrl" alt="" />
          <span>Jura Wolpertinger</span>
        </RouterLink>
        <nav class="nav" aria-label="Hauptnavigation">
          <UNavigationMenu :items="homeNavigationItems" orientation="vertical" />
        <p class="nav-section">Karteikarten</p>
          <UNavigationMenu :items="flashcardNavigationItems" orientation="vertical" />
        <p class="nav-section">Prüfungen</p>
          <UNavigationMenu :items="examNavigationItems" orientation="vertical" />
          <UNavigationMenu :items="moreNavigationItems" orientation="vertical" />
        </nav>
        <div class="sidebar-footer">
          <section class="sidebar-user" aria-label="Nutzer">
            <UFormField label="Nutzer">
              <USelect
                id="user-switcher"
                class="user-switcher"
                :model-value="currentUser?.id"
                :items="userOptions"
                value-key="value"
                @update:model-value="switchUser"
              />
            </UFormField>
            <UButton class="sidebar-small-button" color="neutral" variant="ghost" @click="showCreateUser = true">
              <UserPlus :size="15" />
              Neuer Nutzer
            </UButton>
            <UButton class="sidebar-small-button" color="neutral" variant="ghost" @click="startTour">
              <Route :size="15" />
              Tour
            </UButton>
          </section>
          <UButton
            class="sidebar-theme-toggle"
            color="neutral"
            variant="ghost"
            :title="isDark ? 'Hellmodus' : 'Dunkelmodus'"
            @click="toggleTheme"
          >
            <span class="theme-toggle-option" :class="{ active: !isDark }">
              <Sun :size="17" />
            </span>
            <span class="theme-toggle-option" :class="{ active: isDark }">
              <Moon :size="17" />
            </span>
          </UButton>
          <span class="sidebar-version">Version {{ appVersion }}</span>
        </div>
      </aside>

      <UNavigationMenu
        v-if="!isExamFocus"
        class="mobile-nav"
        :items="mobileNavigationItems"
        aria-label="Hauptnavigation"
      />

      <main class="main-pane">
        <RouterView />
      </main>

      <UModal :open="showTourPrompt" :dismissible="false" @update:open="showTourPrompt = $event">
        <template #content>
          <section class="modal-card onboarding-card" aria-labelledby="onboarding-title">
            <div class="onboarding-heading">
              <img class="onboarding-image" :src="welcomeImageUrl" alt="" />
              <div>
                <p class="eyebrow">Erste Schritte</p>
                <h2 id="onboarding-title">Was möchtest du als Nächstes tun?</h2>
                <p>Wähle einen Einstieg oder starte direkt. Du kannst alles später in den Einstellungen ändern.</p>
              </div>
            </div>
            <div class="onboarding-actions" aria-label="Onboarding Aktionen">
              <UButton type="button" class="onboarding-action-card" variant="outline" @click="openOnboardingTarget('flashcards')">
                <Layers :size="20" aria-hidden="true" />
                <span>Karteikarten lernen</span>
                <small>Wiederholen oder Sammlungen öffnen.</small>
              </UButton>
              <UButton type="button" class="onboarding-action-card" variant="outline" @click="openOnboardingTarget('exam')">
                <LibraryBig :size="20" aria-hidden="true" />
                <span>Klausur schreiben</span>
                <small>Prüfungsbibliothek und Schreibmodus.</small>
              </UButton>
              <UButton type="button" class="onboarding-action-card" variant="outline" @click="openOnboardingTarget('import')">
                <FolderKanban :size="20" aria-hidden="true" />
                <span>Daten importieren</span>
                <small>Vorhandene Karteikarten aus einer Datei übernehmen.</small>
              </UButton>
              <UButton type="button" class="onboarding-action-card" variant="outline" @click="openOnboardingTarget('settings')">
                <Settings :size="20" aria-hidden="true" />
                <span>{{ onboardingSettingsTitle }}</span>
                <small>{{ onboardingSettingsCopy }}</small>
              </UButton>
            </div>
            <div class="modal-actions">
              <UButton color="neutral" variant="outline" @click="showTourPrompt = false">Direkt zur App</UButton>
              <UButton @click="skipOnboarding">Nicht mehr anzeigen</UButton>
            </div>
          </section>
        </template>
      </UModal>

      <UModal :open="showCreateUser" :dismissible="false" @update:open="showCreateUser = $event">
        <template #content>
          <section class="modal-card" aria-labelledby="create-user-title">
            <h2 id="create-user-title">Neuer lokaler Nutzer</h2>
            <p>
              Lege einen eigenen Arbeitsbereich an. Klausuren, Bewertungen und Einstellungen bleiben
              getrennt und können später bei Bedarf übernommen werden.
            </p>
            <UFormField label="Name" class="form-field">
              <UInput v-model="newUserName" autofocus placeholder="z. B. Sebastian" @keyup.enter="createUser" />
            </UFormField>
            <div class="modal-actions">
              <UButton color="neutral" variant="outline" @click="showCreateUser = false">Abbrechen</UButton>
              <UButton :disabled="!newUserName.trim()" @click="createUser">Erstellen</UButton>
            </div>
          </section>
        </template>
      </UModal>
    </div>
  </UApp>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FolderKanban, Layers, LibraryBig, Moon, Route, Settings, Sun, UserPlus } from 'lucide-vue-next'
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
const userOptions = computed(() =>
  users.value.map((user) => ({
    label: `${user.displayName}${user.kind === 'demo' ? ' · Demo' : ''}`,
    value: user.id
  }))
)
const homeNavigationItems = computed(() => [
  { label: 'Home', icon: 'i-lucide-house', to: { name: 'home' }, active: route.name === 'home' }
])
const flashcardNavigationItems = computed(() => [
  {
    label: 'Wiederholen',
    icon: 'i-lucide-layers',
    to: { name: 'flashcards-review' },
    active: route.name === 'flashcards-review'
  },
  {
    label: 'Sammlungen',
    icon: 'i-lucide-folder-kanban',
    to: { name: 'flashcards-collections' },
    active: ['flashcards-collections', 'flashcards-collection'].includes(String(route.name))
  }
])
const examNavigationItems = computed(() => [
  {
    label: 'Bibliothek',
    icon: 'i-lucide-library-big',
    to: { name: 'dashboard' },
    active: ['dashboard', 'exam', 'exam-focus'].includes(String(route.name))
  },
  {
    label: 'Bewertung',
    icon: 'i-lucide-clipboard-check',
    to: { name: 'correction' },
    active: route.name === 'correction'
  },
  {
    label: 'Auswertung',
    icon: 'i-lucide-chart-no-axes-combined',
    to: { name: 'analytics' },
    active: route.name === 'analytics'
  }
])
const moreNavigationItems = computed(() => [
  { label: 'Einstellungen', icon: 'i-lucide-settings', to: { name: 'settings' }, active: route.name === 'settings' },
  { label: 'About', icon: 'i-lucide-info', to: { name: 'about' }, active: route.name === 'about' },
  { label: 'Hilfe', icon: 'i-lucide-circle-help', to: { name: 'help' }, active: route.name === 'help' }
])
const mobileNavigationItems = computed(() => [
  { label: 'Home', icon: 'i-lucide-house', to: { name: 'home' }, active: route.path === '/' },
  {
    label: 'Karteikarten',
    icon: 'i-lucide-layers',
    to: { name: 'flashcards' },
    active: route.path.startsWith('/flashcards')
  },
  {
    label: 'Prüfungen',
    icon: 'i-lucide-library-big',
    to: { name: 'exams' },
    active: route.path.startsWith('/exams')
  },
  {
    label: 'Mehr',
    icon: 'i-lucide-ellipsis',
    to: { name: 'more' },
    active: route.path.startsWith('/more')
  }
])
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

async function switchUser(userId: string | undefined): Promise<void> {
  if (!userId) return
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
