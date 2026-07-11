<template>
  <section class="settings-view">
    <header class="page-header">
      <div>
        <UBreadcrumb class="app-breadcrumb" :items="withHomeIcon(breadcrumbItems)" />
        <p class="eyebrow">Einstellungen</p>
        <h1>App einrichten</h1>
      </div>
    </header>

    <UAlert v-if="actionError" class="action-error" color="error" :description="actionError" />
    <UAlert v-if="actionNotice" class="action-notice" color="success" :description="actionNotice" />

    <div class="settings-grid">
      <section class="settings-panel">
        <div class="panel-header">
          <div>
            <h2>Nutzer</h2>
            <p class="settings-copy">Arbeitsbereiche bleiben lokal getrennt.</p>
          </div>
        </div>

        <UFormField class="settings-field" label="Aktueller Nutzer">
          <USelect :model-value="currentUser?.id" :items="userOptions" value-key="value" @update:model-value="switchUser" />
        </UFormField>

        <UFormField class="settings-field" label="Nutzername">
          <div class="settings-inline-control">
            <UInput v-model="currentUserName" placeholder="Name" @keyup.enter="saveCurrentUserName" />
            <UButton type="button" :disabled="!currentUser" @click="saveCurrentUserName">Speichern</UButton>
          </div>
        </UFormField>

        <div class="settings-actions">
          <UButton type="button" color="neutral" variant="outline" @click="startTour">Tour starten</UButton>
          <UButton type="button" color="neutral" variant="outline" :disabled="!currentUser" @click="resetTour">
            Tour zurücksetzen
          </UButton>
        </div>
      </section>

      <section class="settings-panel">
        <div class="panel-header">
          <div>
            <h2>Neuer Nutzer</h2>
            <p class="settings-copy">
              Lege einen getrennten lokalen Arbeitsbereich für eigene Klausuren oder Tests an.
            </p>
          </div>
        </div>

        <UFormField class="settings-field" label="Name">
          <div class="settings-inline-control">
            <UInput v-model="newUserName" placeholder="z. B. Sebastian" @keyup.enter="createUser" />
            <UButton type="button" :disabled="!newUserName.trim()" @click="createUser">Anlegen</UButton>
          </div>
        </UFormField>
      </section>

      <section class="settings-panel">
        <div class="panel-header">
          <div>
            <h2>Online-Version</h2>
            <p class="settings-copy">
              Sichere deinen Arbeitsbereich online oder lade ihn auf ein anderes Gerät.
            </p>
          </div>
          <UBadge :color="syncStatus.connected ? 'success' : 'neutral'" variant="soft">
            {{ syncStatus.connected ? 'verbunden' : 'nicht verbunden' }}
          </UBadge>
        </div>

        <div class="settings-ai-status">
          <strong>{{ syncStatus.connected ? 'Online-Konto verbunden' : 'Noch nicht verbunden' }}</strong>
          <p>
            {{ !isElectronApiAvailable
              ? 'Diese Web-App speichert bereits online.'
              : syncStatus.connected
              ? 'Deine lokalen Daten bleiben erhalten. Du entscheidest, wann übertragen wird.'
              : 'Verbinde diesen Arbeitsbereich mit deinem Online-Konto.' }}
          </p>
          <span v-if="syncStatus.remoteEmail">{{ syncStatus.remoteEmail }}</span>
          <span v-if="syncStatus.lastSyncedAt">Zuletzt: {{ formatDateTime(syncStatus.lastSyncedAt) }}</span>
          <span v-if="syncStatus.lastSyncSummary">{{ syncStatus.lastSyncSummary }}</span>
        </div>

        <div v-if="isElectronApiAvailable" class="settings-actions">
          <UButton v-if="!syncStatus.connected" type="button" @click="openSyncConnectModal">
            Mit Online-Version verbinden
          </UButton>
          <template v-else>
            <UButton type="button" :loading="syncBusy" @click="openSyncConfirm('merge')">
              Alles abgleichen
            </UButton>
            <UButton type="button" color="neutral" variant="outline" :disabled="syncBusy" @click="openSyncConfirm('upload')">
              Lokale Daten online sichern
            </UButton>
            <UButton type="button" color="neutral" variant="outline" :disabled="syncBusy" @click="openSyncConfirm('download')">
              Online-Daten auf dieses Gerät holen
            </UButton>
            <UButton type="button" color="error" variant="outline" :loading="syncBusy" @click="disconnectSync">
              Verbindung trennen
            </UButton>
          </template>
        </div>

        <p v-if="syncResultSummary" class="settings-test-ok">{{ syncResultSummary }}</p>
      </section>

      <section class="settings-panel">
        <div class="panel-header">
          <div>
            <h2>KI-Korrektur</h2>
            <p class="settings-copy">
              Aufgabenstellung, Musterlösung und Abgabe werden nur auf deine ausdrückliche Anfrage an den
              konfigurierten KI-Anbieter übertragen.
            </p>
          </div>
          <UBadge :color="aiSettings.configured ? 'success' : 'neutral'" variant="soft">
            {{ aiSettings.configured ? 'aktiv' : 'nicht eingerichtet' }}
          </UBadge>
        </div>

        <div class="settings-ai-status">
          <strong>{{ aiStatusTitle }}</strong>
          <p>{{ aiStatusDescription }}</p>
          <span v-if="aiKeyPreview">Key: {{ aiKeyPreview }}</span>
          <span v-if="effectiveAiSource === 'stored' && aiSettings.updatedAt">
            Gespeichert: {{ formatDateTime(aiSettings.updatedAt) }}
          </span>
          <span>Modell: {{ aiSettings.model ?? DEFAULT_AI_MODEL }}</span>
          <span v-if="storedKeyOverridesEnvironment" class="settings-ai-hint">
            Gespeicherter App-Key überschreibt deinen .env-Key.
          </span>
          <span v-if="aiConnectionMessage" :class="aiConnectionOk ? 'settings-test-ok' : 'settings-test-error'">
            {{ aiConnectionMessage }}
          </span>
        </div>

        <div v-if="!showAiKeyForm" class="settings-actions">
          <UButton type="button" @click="openAiKeyForm">{{ aiSetupButtonLabel }}</UButton>
          <UButton type="button" color="neutral" variant="outline" :disabled="!aiSettings.configured || aiBusy" @click="testAiConnection">
            {{ aiBusy ? 'Prüft ...' : 'Verbindung testen' }}
          </UButton>
          <UButton
            v-if="storedKeyOverridesEnvironment"
            type="button"
            color="neutral"
            variant="outline"
            :disabled="aiBusy"
            @click="testEnvironmentConnection"
          >
            .env-Key testen
          </UButton>
          <UButton
            v-if="effectiveAiSource === 'stored'"
            type="button"
            color="error"
            variant="outline"
            :disabled="aiBusy"
            @click="startRemoveAiSettings"
          >
            App-Key entfernen
          </UButton>
        </div>

        <div v-if="confirmRemoveAiKey" class="settings-confirm-remove">
          <strong>App-Key entfernen?</strong>
          <p>KI-Korrekturen nutzen danach keinen gespeicherten App-Key mehr.</p>
          <div class="settings-actions">
            <UButton type="button" color="error" :loading="aiBusy" @click="removeAiSettings">
              Entfernen
            </UButton>
            <UButton type="button" color="neutral" variant="outline" :disabled="aiBusy" @click="cancelRemoveAiSettings">
              Abbrechen
            </UButton>
          </div>
        </div>

        <form v-if="showAiKeyForm" class="settings-key-form" @submit.prevent="saveAiSettings">
          <UFormField class="settings-field" label="OpenAI API-Key">
            <UInput v-model="aiApiKeyInput" type="password" :placeholder="aiKeyPlaceholder" />
            <span v-if="effectiveAiSource === 'stored'" class="settings-field-note">
              Der gespeicherte Key bleibt erhalten, wenn du hier nichts eingibst.
            </span>
          </UFormField>
          <UFormField class="settings-field" label="Modell">
            <UInput v-model="aiModelInput" :placeholder="DEFAULT_AI_MODEL" />
          </UFormField>

          <div class="settings-actions">
            <UButton type="submit" :loading="aiBusy">
              {{ aiBusy ? 'Speichert ...' : 'Speichern' }}
            </UButton>
            <UButton type="button" color="neutral" variant="outline" :disabled="aiBusy" @click="cancelAiKeyForm">
              Abbrechen
            </UButton>
          </div>
        </form>
      </section>

      <section class="settings-panel">
        <div class="panel-header">
          <div>
            <h2>Oberfläche</h2>
            <p class="settings-copy">Wähle den Modus, in dem du länger schreiben und korrigieren möchtest.</p>
          </div>
        </div>

        <div class="settings-mode-row" role="group" aria-label="Farbschema">
          <UButton type="button" color="neutral" :variant="!isDark ? 'solid' : 'outline'" @click="setLightTheme">
            Hellmodus
          </UButton>
          <UButton type="button" color="neutral" :variant="isDark ? 'solid' : 'outline'" @click="setDarkTheme">
            Dunkelmodus
          </UButton>
        </div>
      </section>
    </div>

    <UModal :open="showSyncConnectModal" @update:open="showSyncConnectModal = $event">
      <template #content>
        <form class="modal-card" aria-labelledby="sync-connect-title" @submit.prevent="connectSync">
          <h2 id="sync-connect-title">Mit Online-Version verbinden</h2>
          <p>Deine lokalen Daten bleiben auf diesem Gerät. Nach der Anmeldung entscheidest du, was übertragen wird.</p>
          <UFormField class="settings-field" label="E-Mail">
            <UInput v-model="syncEmail" type="email" autocomplete="email" required />
          </UFormField>
          <UFormField class="settings-field" label="Passwort">
            <UInput v-model="syncPassword" type="password" autocomplete="current-password" required />
          </UFormField>
          <div class="modal-actions">
            <UButton type="button" color="neutral" variant="outline" :disabled="syncBusy" @click="closeSyncConnectModal">
              Abbrechen
            </UButton>
            <UButton type="submit" :loading="syncBusy" :disabled="!syncEmail.trim() || !syncPassword">
              {{ syncBusy ? 'Verbindet ...' : 'Jetzt verbinden' }}
            </UButton>
          </div>
        </form>
      </template>
    </UModal>

    <UModal :open="Boolean(syncConfirmAction)" @update:open="!$event && (syncConfirmAction = null)">
      <template #content>
        <section class="modal-card" aria-labelledby="sync-confirm-title">
          <h2 id="sync-confirm-title">{{ syncConfirmTitle }}</h2>
          <p>{{ syncConfirmCopy }}</p>
          <div class="modal-actions">
            <UButton type="button" color="neutral" variant="outline" :disabled="syncBusy" @click="syncConfirmAction = null">
              Abbrechen
            </UButton>
            <UButton type="button" :loading="syncBusy" @click="runSyncAction">
              {{ syncBusy ? 'Überträgt ...' : syncConfirmButton }}
            </UButton>
          </div>
        </section>
      </template>
    </UModal>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { AiSettingsStatus, AppUser } from '@shared/ipc'
import type { SyncRunAction, SyncStatus } from '@shared/schemas'
import { DEFAULT_AI_MODEL } from '@shared/constants'
import { aiConnectionFallbackMessage, type AiConnectionTestSource } from '@shared/aiConnectionFeedback'
import { api, isElectronApiAvailable } from '../api'
import { type AppBreadcrumbItem, withHomeIcon } from '../ui/breadcrumbs'
import { useTheme } from '../theme'

const breadcrumbItems: AppBreadcrumbItem[] = [
  { label: 'Home', to: { name: 'home' } },
  { label: 'Mehr', to: { name: 'more' } },
  { label: 'Einstellungen' }
]

const { isDark, toggleTheme, applyTheme } = useTheme()
const users = ref<AppUser[]>([])
const currentUser = ref<AppUser | null>(null)
const currentUserName = ref('')
const newUserName = ref('')
const aiSettings = ref<AiSettingsStatus>({
  provider: 'openai',
  configured: false,
  model: null,
  source: null,
  keyPreview: null,
  environmentAvailable: false,
  updatedAt: null
})
const aiApiKeyInput = ref('')
const aiModelInput = ref(DEFAULT_AI_MODEL)
const aiBusy = ref(false)
const showAiKeyForm = ref(false)
const confirmRemoveAiKey = ref(false)
const actionError = ref('')
const actionNotice = ref('')
const aiConnectionMessage = ref('')
const aiConnectionOk = ref(false)
const syncStatus = ref<SyncStatus>({
  connected: false,
  remoteUserId: null,
  remoteEmail: null,
  lastSyncedAt: null,
  lastSyncSummary: null
})
const showSyncConnectModal = ref(false)
const syncEmail = ref('')
const syncPassword = ref('')
const syncBusy = ref(false)
const syncResultSummary = ref('')
const syncConfirmAction = ref<SyncRunAction | null>(null)
const userOptions = computed(() =>
  users.value.map((user) => ({
    label: `${user.displayName}${user.kind === 'demo' ? ' · Demo' : ''}`,
    value: user.id
  }))
)
const effectiveAiSource = computed(() =>
  aiSettings.value.source ?? (aiSettings.value.configured ? 'stored' : null)
)
const aiKeyPreview = computed(() =>
  aiSettings.value.keyPreview ?? (effectiveAiSource.value === 'stored' ? 'gespeichert' : null)
)
const aiKeyPlaceholder = computed(() =>
  effectiveAiSource.value === 'stored' ? 'neuer Key oder leer lassen' : 'sk-...'
)
const storedKeyOverridesEnvironment = computed(
  () => effectiveAiSource.value === 'stored' && Boolean(aiSettings.value.environmentAvailable)
)
const aiStatusTitle = computed(() => {
  if (effectiveAiSource.value === 'stored') return 'OpenAI-Key gespeichert'
  if (effectiveAiSource.value === 'environment') return 'Entwicklungs-Key aktiv'
  return 'OpenAI-Key fehlt'
})
const aiStatusDescription = computed(() => {
  if (effectiveAiSource.value === 'stored') return 'KI-Korrekturen nutzen den lokal gespeicherten App-Key.'
  if (effectiveAiSource.value === 'environment') return 'Der Key kommt aus deiner lokalen .env-Datei.'
  return 'Richte einen eigenen OpenAI-Key ein, bevor KI-Korrekturen gestartet werden.'
})
const aiSetupButtonLabel = computed(() =>
  effectiveAiSource.value === 'stored'
    ? 'Key oder Modell ändern'
    : effectiveAiSource.value === 'environment'
      ? 'Eigenen App-Key speichern'
      : 'OpenAI-Key einrichten'
)
const syncConfirmTitle = computed(() => {
  if (syncConfirmAction.value === 'upload') return 'Lokale Daten online sichern?'
  if (syncConfirmAction.value === 'download') return 'Online-Daten auf dieses Gerät holen?'
  return 'Alles abgleichen?'
})
const syncConfirmCopy = computed(() => {
  if (syncConfirmAction.value === 'upload') {
    return 'Der aktuelle lokale Arbeitsbereich wird online gesichert. Bereits online gesicherte Daten dieses Arbeitsbereichs werden ersetzt.'
  }
  if (syncConfirmAction.value === 'download') {
    return 'Der online gespeicherte Arbeitsbereich wird auf dieses Gerät geladen. Lokale fachliche Daten dieses Arbeitsbereichs werden ersetzt.'
  }
  return 'Die App prüft lokale und online gesicherte Daten. Bei unterschiedlichen Änderungen stoppt der Abgleich und fragt nach einer Richtung.'
})
const syncConfirmButton = computed(() => {
  if (syncConfirmAction.value === 'upload') return 'Online sichern'
  if (syncConfirmAction.value === 'download') return 'Auf dieses Gerät laden'
  return 'Jetzt abgleichen'
})

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value))
}

onMounted(load)

async function load(): Promise<void> {
  applyTheme()
  currentUser.value = await api.getCurrentUser()
  users.value = await api.listUsers()
  currentUserName.value = currentUser.value.displayName
  aiSettings.value = await api.getAiSettingsStatus()
  aiModelInput.value = aiSettings.value.model ?? DEFAULT_AI_MODEL
  syncStatus.value = await api.getSyncStatus()
}

function openSyncConnectModal(): void {
  actionError.value = ''
  actionNotice.value = ''
  syncResultSummary.value = ''
  syncPassword.value = ''
  showSyncConnectModal.value = true
}

function closeSyncConnectModal(): void {
  showSyncConnectModal.value = false
  syncPassword.value = ''
}

async function connectSync(): Promise<void> {
  actionError.value = ''
  actionNotice.value = ''
  syncResultSummary.value = ''
  syncBusy.value = true
  try {
    syncStatus.value = await api.connectSyncAccount({
      email: syncEmail.value.trim(),
      password: syncPassword.value
    })
    closeSyncConnectModal()
    actionNotice.value = 'Online-Version verbunden.'
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : String(error)
  } finally {
    syncBusy.value = false
  }
}

async function disconnectSync(): Promise<void> {
  actionError.value = ''
  actionNotice.value = ''
  syncResultSummary.value = ''
  syncBusy.value = true
  try {
    syncStatus.value = await api.disconnectSyncAccount()
    actionNotice.value = 'Online-Verbindung getrennt.'
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : String(error)
  } finally {
    syncBusy.value = false
  }
}

function openSyncConfirm(action: SyncRunAction): void {
  actionError.value = ''
  actionNotice.value = ''
  syncResultSummary.value = ''
  syncConfirmAction.value = action
}

async function runSyncAction(): Promise<void> {
  if (!syncConfirmAction.value) return
  actionError.value = ''
  actionNotice.value = ''
  syncResultSummary.value = ''
  syncBusy.value = true
  try {
    const result = await api.runSync({ action: syncConfirmAction.value })
    syncConfirmAction.value = null
    syncResultSummary.value = `${result.summary} Dateien hochgeladen: ${result.uploadedFiles}. Dateien geladen: ${result.downloadedFiles}.`
    syncStatus.value = await api.getSyncStatus()
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : String(error)
  } finally {
    syncBusy.value = false
  }
}

function openAiKeyForm(): void {
  actionError.value = ''
  actionNotice.value = ''
  aiConnectionMessage.value = ''
  confirmRemoveAiKey.value = false
  aiApiKeyInput.value = ''
  aiModelInput.value = aiSettings.value.model ?? DEFAULT_AI_MODEL
  showAiKeyForm.value = true
}

function cancelAiKeyForm(): void {
  aiApiKeyInput.value = ''
  aiModelInput.value = aiSettings.value.model ?? DEFAULT_AI_MODEL
  showAiKeyForm.value = false
}

function startRemoveAiSettings(): void {
  actionError.value = ''
  actionNotice.value = ''
  aiConnectionMessage.value = ''
  showAiKeyForm.value = false
  confirmRemoveAiKey.value = true
}

function cancelRemoveAiSettings(): void {
  confirmRemoveAiKey.value = false
}

async function switchUser(userId: string | undefined): Promise<void> {
  if (!userId) return
  await api.switchUser(userId)
  window.location.reload()
}

async function createUser(): Promise<void> {
  const name = newUserName.value.trim()
  if (!name) return
  await api.createUser(name)
  window.location.reload()
}

async function saveCurrentUserName(): Promise<void> {
  if (!currentUser.value) return
  actionError.value = ''
  actionNotice.value = ''
  try {
    currentUser.value = await api.updateUser({
      id: currentUser.value.id,
      displayName: currentUserName.value
    })
    currentUserName.value = currentUser.value.displayName
    users.value = await api.listUsers()
    window.dispatchEvent(new CustomEvent('jura:users-updated'))
    actionNotice.value = 'Nutzername gespeichert.'
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : String(error)
  }
}

async function resetTour(): Promise<void> {
  if (!currentUser.value) return
  currentUser.value = await api.resetTour(currentUser.value.id)
  actionNotice.value = 'Tour zurückgesetzt.'
}

function startTour(): void {
  window.dispatchEvent(new CustomEvent('jura:start-tour'))
}

async function saveAiSettings(): Promise<void> {
  actionError.value = ''
  actionNotice.value = ''
  aiConnectionMessage.value = ''
  aiBusy.value = true
  try {
    aiSettings.value = await api.saveAiSettings({
      provider: 'openai',
      apiKey: aiApiKeyInput.value,
      model: aiModelInput.value.trim() || DEFAULT_AI_MODEL
    })
    aiModelInput.value = aiSettings.value.model ?? DEFAULT_AI_MODEL
    aiApiKeyInput.value = ''
    showAiKeyForm.value = false
    actionNotice.value = 'KI-Einstellungen gespeichert.'
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : String(error)
  } finally {
    aiBusy.value = false
  }
}

async function removeAiSettings(): Promise<void> {
  actionError.value = ''
  actionNotice.value = ''
  aiConnectionMessage.value = ''
  aiBusy.value = true
  try {
    aiSettings.value = await api.removeAiSettings()
    aiModelInput.value = aiSettings.value.model ?? DEFAULT_AI_MODEL
    aiApiKeyInput.value = ''
    showAiKeyForm.value = false
    confirmRemoveAiKey.value = false
    actionNotice.value =
      effectiveAiSource.value === 'environment'
        ? 'App-Key entfernt. Der Entwicklungs-Key aus .env ist weiter aktiv.'
        : 'OpenAI-Key entfernt.'
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : String(error)
  } finally {
    aiBusy.value = false
  }
}

async function runAiConnectionTest(source: AiConnectionTestSource): Promise<void> {
  actionError.value = ''
  actionNotice.value = ''
  aiConnectionOk.value = false
  aiConnectionMessage.value =
    source === 'environment' ? '.env-Verbindungstest läuft ...' : 'Verbindungstest läuft ...'
  aiBusy.value = true
  try {
    if (typeof api.testAiConnection !== 'function') {
      aiConnectionOk.value = false
      aiConnectionMessage.value = 'Bitte App neu starten, damit der Verbindungstest verfügbar ist.'
      actionError.value = aiConnectionMessage.value
      return
    }
    const result = await api.testAiConnection({ source })
    aiConnectionOk.value = result.ok
    aiConnectionMessage.value = result.message
    if (!result.ok) actionError.value = result.message
  } catch (error) {
    aiConnectionOk.value = false
    aiConnectionMessage.value = aiConnectionFallbackMessage(source)
    actionError.value = error instanceof Error ? error.message : String(error)
  } finally {
    aiBusy.value = false
  }
}

async function testAiConnection(): Promise<void> {
  await runAiConnectionTest('active')
}

async function testEnvironmentConnection(): Promise<void> {
  await runAiConnectionTest('environment')
}

function setLightTheme(): void {
  if (isDark.value) toggleTheme()
}

function setDarkTheme(): void {
  if (!isDark.value) toggleTheme()
}
</script>
