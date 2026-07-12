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
import type { AppUser } from '@shared/ipc'
import type { SyncRunAction, SyncStatus } from '@shared/schemas'
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
const actionError = ref('')
const actionNotice = ref('')
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

function setLightTheme(): void {
  if (isDark.value) toggleTheme()
}

function setDarkTheme(): void {
  if (!isDark.value) toggleTheme()
}
</script>
