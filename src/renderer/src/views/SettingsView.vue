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
          <UBadge :color="syncBadgeColor" variant="soft">
            {{ syncStatusView.badge }}
          </UBadge>
        </div>

        <div class="settings-ai-status">
          <strong>{{ syncStatusView.title }}</strong>
          <p>{{ syncStatusView.description }}</p>
          <span>{{ syncStatusView.detail }}</span>
          <span v-if="syncStatus.remoteEmail">{{ syncStatus.remoteEmail }}</span>
          <span v-if="syncStatus.lastSyncSummary">{{ syncStatus.lastSyncSummary }}</span>
        </div>

        <div v-if="isElectronApiAvailable" class="sync-flow" aria-label="Synchronisationsweg">
          <div>
            <strong>Dieses Gerät</strong>
            <span>Karteikarten, Prüfungen, Bewertungen, Anhänge</span>
          </div>
          <span aria-hidden="true">↔</span>
          <div>
            <strong>Online-Sicherung</strong>
            <span>verschlüsselte Verbindung mit deinem Konto</span>
          </div>
          <span aria-hidden="true">↔</span>
          <div>
            <strong>Andere Geräte</strong>
            <span>nach Anmeldung denselben Arbeitsbereich holen</span>
          </div>
        </div>

        <div v-if="isElectronApiAvailable" class="settings-actions">
          <UButton v-if="!syncStatus.connected" type="button" @click="openSyncConnectModal">
            Online-Sicherung einrichten
          </UButton>
          <template v-else>
            <UButton type="button" :loading="syncBusy" @click="openSyncConfirm(syncActionViews[0].action)">
              {{ syncActionViews[0].label }}
            </UButton>
            <UButton type="button" color="neutral" variant="outline" :disabled="syncBusy" @click="openSyncConfirm(syncActionViews[1].action)">
              {{ syncActionViews[1].label }}
            </UButton>
            <UButton type="button" color="neutral" variant="outline" :disabled="syncBusy" @click="openSyncConfirm(syncActionViews[2].action)">
              {{ syncActionViews[2].label }}
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
          <h2 id="sync-connect-title">Online-Sicherung einrichten</h2>
          <p>Deine lokalen Daten bleiben auf diesem Gerät. Nach der Anmeldung fragt die App, ob du direkt alles abgleichen möchtest.</p>
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
          <div class="sync-confirm-flow">
            <span>Dieses Gerät</span>
            <strong>{{ syncConfirmDirection }}</strong>
            <span>Online-Sicherung</span>
          </div>
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
import { useRoute, useRouter } from 'vue-router'
import type { AppUser } from '@shared/ipc'
import type { SyncRunAction, SyncStatus } from '@shared/schemas'
import { api, isElectronApiAvailable } from '../api'
import { getSyncStatusView, getWorkspaceSyncAction, getWorkspaceSyncActions } from '../syncWorkspaceUx'
import { type AppBreadcrumbItem, withHomeIcon } from '../ui/breadcrumbs'
import { useTheme } from '../theme'

const breadcrumbItems: AppBreadcrumbItem[] = [
  { label: 'Home', to: { name: 'home' } },
  { label: 'Mehr', to: { name: 'more' } },
  { label: 'Einstellungen' }
]

const { isDark, toggleTheme, applyTheme } = useTheme()
const route = useRoute()
const router = useRouter()
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
const syncStatusView = computed(() => {
  if (!isElectronApiAvailable && syncStatus.value.connected) {
    return {
      badge: 'Online angemeldet',
      title: 'Web-App online',
      description: 'Diese Web-App speichert deine Lern- und Prüfungsdaten direkt online.',
      detail: 'Änderungen werden automatisch gespeichert.',
      tone: 'success' as const
    }
  }
  return getSyncStatusView(syncStatus.value)
})
const syncBadgeColor = computed(() => {
  if (syncStatusView.value.tone === 'success') return 'success'
  if (syncStatusView.value.tone === 'warning') return 'warning'
  if (syncStatusView.value.tone === 'danger') return 'error'
  return 'neutral'
})
const syncActionViews = getWorkspaceSyncActions()
const syncConfirmTitle = computed(() => {
  return getWorkspaceSyncAction(syncConfirmAction.value ?? 'merge').title
})
const syncConfirmCopy = computed(() => {
  return getWorkspaceSyncAction(syncConfirmAction.value ?? 'merge').description
})
const syncConfirmButton = computed(() => {
  return getWorkspaceSyncAction(syncConfirmAction.value ?? 'merge').confirmButton
})
const syncConfirmDirection = computed(() => {
  if (syncConfirmAction.value === 'upload') return '→'
  if (syncConfirmAction.value === 'download') return '←'
  return '↔'
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
  if (route.query.connectOnline === '1' && isElectronApiAvailable) {
    await router.replace({ name: 'settings' })
    if (syncStatus.value.connected) {
      syncConfirmAction.value = 'merge'
    } else {
      openSyncConnectModal()
    }
  }
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
    actionNotice.value = 'Online-Sicherung verbunden. Prüfe jetzt, wie du die Daten abgleichen möchtest.'
    syncConfirmAction.value = 'merge'
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
