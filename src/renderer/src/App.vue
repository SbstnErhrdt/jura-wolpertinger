<template>
  <UApp>
    <section
      v-if="cloudAuth.status !== 'not_required' && (cloudAuth.status !== 'signed_in' || authMode === 'update_password')"
      class="auth-gate"
    >
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
          v-if="cloudAuth.status !== 'missing_config' && !['reset_password', 'update_password'].includes(authMode)"
          class="auth-mode-switch"
          aria-label="Anmeldung oder Registrierung auswählen"
        >
          <span class="auth-mode-segment" :class="{ 'is-active': authMode === 'sign_in' }">
            <UButton
              type="button"
              class="auth-mode-button"
              color="neutral"
              variant="ghost"
              label="Einloggen"
              :aria-pressed="authMode === 'sign_in'"
              @click="setAuthMode('sign_in')"
            />
          </span>
          <span class="auth-mode-segment" :class="{ 'is-active': authMode === 'sign_up' }">
            <UButton
              type="button"
              class="auth-mode-button"
              color="neutral"
              variant="ghost"
              label="Account erstellen"
              :aria-pressed="authMode === 'sign_up'"
              @click="setAuthMode('sign_up')"
            />
          </span>
        </div>
        <form v-if="cloudAuth.status !== 'missing_config'" class="auth-form" @submit.prevent="submitAuthForm">
          <UFormField v-if="authMode !== 'update_password'" label="E-Mail" class="auth-field">
            <UInput v-model="authEmail" class="auth-input" type="email" autocomplete="email" required />
          </UFormField>
          <UFormField v-if="['sign_in', 'sign_up'].includes(authMode)" label="Passwort" class="auth-field">
            <UInput
              v-model="authPassword"
              class="auth-input"
              type="password"
              :autocomplete="authMode === 'sign_up' ? 'new-password' : 'current-password'"
              required
            />
          </UFormField>
          <template v-if="authMode === 'update_password'">
            <UFormField label="Neues Passwort" class="auth-field">
              <UInput
                v-model="authPassword"
                class="auth-input"
                type="password"
                autocomplete="new-password"
                required
              />
            </UFormField>
            <UFormField label="Neues Passwort wiederholen" class="auth-field">
              <UInput
                v-model="authPasswordConfirm"
                class="auth-input"
                type="password"
                autocomplete="new-password"
                required
              />
            </UFormField>
          </template>
          <div v-if="authMode === 'sign_in'" class="auth-inline-action">
            <UButton
              type="button"
              class="link-button"
              color="neutral"
              variant="link"
              :disabled="authBusy"
              label="Passwort vergessen?"
              @click="setAuthMode('reset_password')"
            />
          </div>
          <p class="auth-action-hint">{{ authActionHint }}</p>
          <UAlert
            v-if="authMessage"
            class="auth-message"
            :color="authMessageKind === 'error' ? 'error' : 'info'"
            :description="authMessage"
          />
          <div class="auth-actions">
            <UButton type="submit" class="auth-submit" :loading="authBusy" :label="authSubmitLabel" />
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
        <UButton
          class="auth-theme-toggle"
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
          <section v-if="isCloudShell" class="sidebar-account" aria-label="Konto">
            <span class="sidebar-account-label">Konto</span>
            <div class="sidebar-account-card">
              <div class="sidebar-account-avatar" aria-hidden="true">{{ cloudAccountInitial }}</div>
              <div class="sidebar-account-copy">
                <strong>{{ cloudAccountTitle }}</strong>
                <span>{{ cloudAccountSubtitle }}</span>
              </div>
            </div>
            <UButton class="sidebar-small-button" color="neutral" variant="ghost" :to="{ name: 'settings' }">
              <Settings :size="15" />
              Profil
            </UButton>
            <UButton class="sidebar-small-button" color="neutral" variant="ghost" @click="signOut">
              <LogOut :size="15" />
              Abmelden
            </UButton>
            <UButton class="sidebar-small-button" color="neutral" variant="ghost" @click="startTour">
              <Route :size="15" />
              Tour
            </UButton>
          </section>
          <section v-else class="sidebar-user" aria-label="Nutzer">
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

      <UModal
        :open="showTourPrompt"
        :dismissible="false"
        title="Was möchtest du als Nächstes tun?"
        @update:open="showTourPrompt = $event"
      >
        <template #content>
          <section v-if="onboardingStep === 'workspace'" class="modal-card onboarding-card" aria-labelledby="onboarding-title">
            <div class="onboarding-heading">
              <img class="onboarding-image" :src="welcomeImageUrl" alt="" />
              <div>
                <p class="eyebrow">Arbeitsbereich</p>
                <h2 id="onboarding-title">Wie möchtest du starten?</h2>
                <p>Dein Arbeitsbereich bleibt auf diesem Gerät. Du kannst ihn optional online sichern und auf anderen Geräten nutzen.</p>
              </div>
            </div>
            <div class="onboarding-actions" aria-label="Arbeitsbereich auswählen">
              <UButton
                v-for="option in syncModeOptions"
                :key="option.id"
                type="button"
                class="onboarding-action-card"
                variant="outline"
                @click="selectWorkspaceMode(option.id)"
              >
                <component :is="option.id === 'local' ? HardDrive : Cloud" :size="20" aria-hidden="true" />
                <span>{{ option.title }}</span>
                <small>{{ option.description }} {{ option.detail }}</small>
              </UButton>
            </div>
            <div class="modal-actions">
              <UButton color="neutral" variant="outline" @click="skipOnboarding">Später entscheiden</UButton>
            </div>
          </section>

          <section v-else class="modal-card onboarding-card" aria-labelledby="onboarding-title">
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
import { Cloud, FolderKanban, HardDrive, Layers, LibraryBig, LogOut, Moon, Route, Settings, Sun, UserPlus } from 'lucide-vue-next'
import type { AppUser } from '@shared/ipc'
import { APP_VERSION } from '@shared/constants'
import { RELEASE_SMOKE_READY_EVENT } from '@shared/releaseSmoke'
import { api, isElectronApiAvailable } from './api'
import { getSupabaseAuthClient, readCloudAuthState, requiresCloudAuth, type CloudAuthState } from './cloudAuth'
import { startOnboardingTour } from './onboarding'
import { getWorkspaceSyncModeOptions, type WorkspaceSyncMode } from './syncWorkspaceUx'
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
const onboardingStep = ref<'workspace' | 'next'>('workspace')
const showCreateUser = ref(false)
const newUserName = ref('')
const cloudAuth = ref<CloudAuthState>(
  requiresCloudAuth()
    ? { status: 'loading', session: null, error: null }
    : { status: 'not_required', session: null, error: null }
)
const authEmail = ref('')
const authPassword = ref('')
const authPasswordConfirm = ref('')
const authBusy = ref(false)
const authMessage = ref('')
const authMessageKind = ref<'info' | 'error'>('info')
const authMode = ref<'sign_in' | 'sign_up' | 'reset_password' | 'update_password'>('sign_in')
const authTitle = computed(() => {
  if (authMode.value === 'sign_up') return 'Kostenlosen Account erstellen'
  if (authMode.value === 'reset_password') return 'Passwort zurücksetzen'
  if (authMode.value === 'update_password') return 'Neues Passwort setzen'
  return 'Einloggen'
})
const authCopy = computed(() => {
  if (authMode.value === 'sign_up') {
    return 'Erstelle deinen kostenlosen Account. Wenn alles passt, wirst du direkt angemeldet.'
  }
  if (authMode.value === 'reset_password') {
    return 'Gib deine E-Mail-Adresse ein. Wir senden dir einen Link, mit dem du dein Passwort neu setzen kannst.'
  }
  if (authMode.value === 'update_password') {
    return 'Wähle ein neues Passwort. Danach öffnet sich deine App wieder automatisch.'
  }
  return 'Melde dich an, um deine Lern- und Prüfungsdaten zu öffnen.'
})
const authActionHint = computed(() => {
  if (authMode.value === 'sign_up') return 'Mit dem Button unten wird der Account sofort erstellt.'
  if (authMode.value === 'reset_password') return 'Du erhältst eine E-Mail, falls für diese Adresse ein Account existiert.'
  if (authMode.value === 'update_password') return 'Das neue Passwort gilt sofort für deinen Account.'
  return 'Mit dem Button unten wirst du direkt angemeldet.'
})
const authSubmitLabel = computed(() => {
  if (authBusy.value) return 'Bitte warten'
  if (authMode.value === 'reset_password') return 'Link zum Zurücksetzen senden'
  if (authMode.value === 'update_password') return 'Passwort speichern'
  return authMode.value === 'sign_up' ? 'Account jetzt erstellen' : 'Jetzt einloggen'
})
const authSwitchText = computed(() => {
  if (authMode.value === 'sign_up') return 'Du hast schon einen Account?'
  if (authMode.value === 'reset_password') return 'Passwort wieder eingefallen?'
  if (authMode.value === 'update_password') return 'Du möchtest doch einloggen?'
  return 'Noch kein Account?'
})
const authSwitchLabel = computed(() => {
  if (authMode.value === 'sign_up') return 'Einloggen'
  if (authMode.value === 'reset_password') return 'Zurück zum Einloggen'
  if (authMode.value === 'update_password') return 'Zum Einloggen'
  return 'Kostenlos erstellen'
})
const onboardingSettingsTitle = computed(() => (isElectronApiAvailable ? 'Cloud verbinden' : 'Einstellungen prüfen'))
const onboardingSettingsCopy = computed(() =>
  isElectronApiAvailable
    ? 'Online sichern und auf anderen Geräten nutzen.'
    : 'Account, App-Status und Optionen prüfen.'
)
const syncModeOptions = getWorkspaceSyncModeOptions()
const isCloudShell = computed(() => cloudAuth.value.status !== 'not_required')
const cloudAccountEmail = computed(() => {
  if (cloudAuth.value.status !== 'signed_in') return ''
  return cloudAuth.value.session.user.email ?? ''
})
const cloudAccountTitle = computed(() => {
  const email = cloudAccountEmail.value
  return currentUser.value?.displayName || email || 'Dein Konto'
})
const cloudAccountSubtitle = computed(() => {
  const email = cloudAccountEmail.value
  if (!email || cloudAccountTitle.value === email) return 'Online angemeldet'
  return email
})
const cloudAccountInitial = computed(() => {
  const source = cloudAccountTitle.value.trim()
  return source ? source.slice(0, 1).toUpperCase() : 'J'
})
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

function getRecoveryTokenHashFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  const tokenHash = params.get('token_hash')?.trim()
  if (!tokenHash || params.get('type') === null || params.get('type') !== 'recovery') return null
  return tokenHash
}

function clearRecoveryTokenHashFromUrl(): void {
  const url = new URL(window.location.href)
  url.searchParams.delete('token_hash')
  url.searchParams.delete('type')
  window.history.replaceState(window.history.state, document.title, `${url.pathname}${url.search}${url.hash}`)
}

async function verifyRecoveryTokenFromUrl(): Promise<void> {
  const tokenHash = getRecoveryTokenHashFromUrl()
  if (!tokenHash) return

  const client = getSupabaseAuthClient()
  if (!client) return

  authBusy.value = true
  authMessageKind.value = 'info'
  authMessage.value = 'Passwort-Link wird geprüft.'

  const { error } = await client.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'recovery'
  })

  clearRecoveryTokenHashFromUrl()
  authBusy.value = false

  if (error) {
    authMode.value = 'reset_password'
    authMessageKind.value = 'error'
    authMessage.value = 'Der Link ist abgelaufen oder wurde bereits verwendet. Bitte fordere einen neuen Link an.'
    return
  }

  authMode.value = 'update_password'
  authPassword.value = ''
  authPasswordConfirm.value = ''
  authMessageKind.value = 'info'
  authMessage.value = ''
  cloudAuth.value = await readCloudAuthState()
}

onMounted(async () => {
  applyTheme()
  if (window.location.hash.includes('type=recovery')) {
    authMode.value = 'update_password'
  }
  cloudAuth.value = await readCloudAuthState()
  getSupabaseAuthClient()?.auth.onAuthStateChange((event, session) => {
    cloudAuth.value = session
      ? { status: 'signed_in', session, error: null }
      : { status: 'signed_out', session: null, error: null }
    if (event === 'PASSWORD_RECOVERY') {
      authMode.value = 'update_password'
      authMessage.value = ''
      authPassword.value = ''
      authPasswordConfirm.value = ''
    }
    if (session) void loadUsers()
  })
  if (cloudAuth.value.status === 'not_required' || cloudAuth.value.status === 'signed_in') {
    await loadUsers()
  }
  await verifyRecoveryTokenFromUrl()
  window.addEventListener('jura:start-tour', startTourListener)
  window.addEventListener('jura:users-updated', usersUpdatedListener)
  await nextTick()
  window.dispatchEvent(new Event(RELEASE_SMOKE_READY_EVENT))
})

onBeforeUnmount(() => {
  window.removeEventListener('jura:start-tour', startTourListener)
  window.removeEventListener('jura:users-updated', usersUpdatedListener)
})

async function loadUsers(): Promise<void> {
  currentUser.value = await api.getCurrentUser()
  users.value = await api.listUsers()
  showTourPrompt.value = !currentUser.value.onboardingCompletedAt
  if (showTourPrompt.value) onboardingStep.value = 'workspace'
}

async function switchUser(userId: string | undefined): Promise<void> {
  if (!userId) return
  currentUser.value = await api.switchUser(userId)
  showTourPrompt.value = !currentUser.value.onboardingCompletedAt
  if (showTourPrompt.value) onboardingStep.value = 'workspace'
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
  onboardingStep.value = 'workspace'
  window.location.reload()
}

async function skipOnboarding(): Promise<void> {
  if (!currentUser.value) return
  currentUser.value = await api.completeOnboarding(currentUser.value.id)
  showTourPrompt.value = false
}

async function selectWorkspaceMode(mode: WorkspaceSyncMode): Promise<void> {
  if (mode === 'local') {
    onboardingStep.value = 'next'
    return
  }
  showTourPrompt.value = false
  if (currentUser.value) {
    currentUser.value = await api.completeOnboarding(currentUser.value.id)
  }
  await router.push({ name: 'settings', query: { connectOnline: '1' } })
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

function setAuthMode(mode: 'sign_in' | 'sign_up' | 'reset_password' | 'update_password'): void {
  authMode.value = mode
  if (mode !== 'reset_password') {
    authPassword.value = ''
    authPasswordConfirm.value = ''
  }
  authMessage.value = ''
}

function toggleAuthMode(): void {
  setAuthMode(authMode.value === 'sign_in' ? 'sign_up' : 'sign_in')
}

async function submitAuthForm(): Promise<void> {
  if (authMode.value === 'sign_up') {
    await registerAuth()
    return
  }
  if (authMode.value === 'reset_password') {
    await resetPassword()
    return
  }
  if (authMode.value === 'update_password') {
    await updateRecoveredPassword()
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

async function resetPassword(): Promise<void> {
  const client = getSupabaseAuthClient()
  if (!client) return
  authBusy.value = true
  authMessage.value = ''
  const { error } = await client.auth.resetPasswordForEmail(authEmail.value.trim(), {
    redirectTo: window.location.origin
  })
  authBusy.value = false
  if (error) {
    authMessageKind.value = 'error'
    authMessage.value = 'Zurücksetzen fehlgeschlagen. Bitte E-Mail-Adresse prüfen.'
    return
  }
  authMessageKind.value = 'info'
  authMessage.value = 'Wenn ein Account existiert, erhältst du eine E-Mail zum Zurücksetzen.'
}

async function updateRecoveredPassword(): Promise<void> {
  const client = getSupabaseAuthClient()
  if (!client) return
  const password = authPassword.value.trim()
  if (password.length < 8) {
    authMessageKind.value = 'error'
    authMessage.value = 'Bitte wähle ein Passwort mit mindestens 8 Zeichen.'
    return
  }
  if (password !== authPasswordConfirm.value.trim()) {
    authMessageKind.value = 'error'
    authMessage.value = 'Die beiden Passwörter stimmen nicht überein.'
    return
  }
  authBusy.value = true
  authMessage.value = ''
  const { error } = await client.auth.updateUser({ password })
  authBusy.value = false
  if (error) {
    authMessageKind.value = 'error'
    authMessage.value = 'Passwort konnte nicht gespeichert werden. Bitte fordere einen neuen Link an.'
    return
  }
  authPassword.value = ''
  authPasswordConfirm.value = ''
  authMessageKind.value = 'info'
  authMessage.value = ''
  authMode.value = 'sign_in'
  cloudAuth.value = await readCloudAuthState()
  if (cloudAuth.value.status === 'signed_in') {
    await loadUsers()
  }
}

async function signOut(): Promise<void> {
  const client = getSupabaseAuthClient()
  if (!client) return
  await client.auth.signOut()
  users.value = []
  currentUser.value = null
  authPassword.value = ''
  authPasswordConfirm.value = ''
  authMessage.value = ''
  cloudAuth.value = await readCloudAuthState()
}
</script>
