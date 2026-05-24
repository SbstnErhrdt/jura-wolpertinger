<template>
  <section class="settings-view">
    <header class="page-header">
      <div>
        <p class="eyebrow">Einstellungen</p>
        <h1>App einrichten</h1>
      </div>
    </header>

    <p v-if="actionError" class="action-error">{{ actionError }}</p>
    <p v-if="actionNotice" class="action-notice">{{ actionNotice }}</p>

    <div class="settings-grid">
      <section class="settings-panel">
        <div class="panel-header">
          <div>
            <h2>Nutzer</h2>
            <p class="settings-copy">Arbeitsbereiche bleiben lokal getrennt.</p>
          </div>
        </div>

        <label class="settings-field">
          Aktueller Nutzer
          <select :value="currentUser?.id" @change="switchUser">
            <option v-for="user in users" :key="user.id" :value="user.id">
              {{ user.displayName }}{{ user.kind === 'demo' ? ' · Demo' : '' }}
            </option>
          </select>
        </label>

        <label class="settings-field">
          Neuer Nutzer
          <div class="settings-inline-control">
            <input v-model="newUserName" placeholder="z. B. Sebastian" @keyup.enter="createUser" />
            <button type="button" :disabled="!newUserName.trim()" @click="createUser">Anlegen</button>
          </div>
        </label>

        <div class="settings-actions">
          <button type="button" class="secondary" @click="startTour">Tour starten</button>
          <button type="button" class="secondary" :disabled="!currentUser" @click="resetTour">
            Tour zurücksetzen
          </button>
        </div>
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
          <span class="settings-status-pill" :class="{ active: aiSettings.configured }">
            {{ aiSettings.configured ? 'aktiv' : 'nicht eingerichtet' }}
          </span>
        </div>

        <label class="settings-field">
          OpenAI API-Key
          <input v-model="aiApiKeyInput" type="password" placeholder="sk-..." />
        </label>
        <label class="settings-field">
          Modell
          <input v-model="aiModelInput" placeholder="gpt-5" />
        </label>

        <div class="settings-actions">
          <button type="button" :disabled="aiBusy" @click="saveAiSettings">
            {{ aiBusy ? 'Speichert ...' : 'KI-Einstellungen speichern' }}
          </button>
        </div>
      </section>

      <section class="settings-panel">
        <div class="panel-header">
          <div>
            <h2>Oberfläche</h2>
            <p class="settings-copy">Wähle den Modus, in dem du länger schreiben und korrigieren möchtest.</p>
          </div>
        </div>

        <div class="settings-mode-row" role="group" aria-label="Farbschema">
          <button type="button" class="secondary" :class="{ active: !isDark }" @click="setLightTheme">
            Hellmodus
          </button>
          <button type="button" class="secondary" :class="{ active: isDark }" @click="setDarkTheme">
            Dunkelmodus
          </button>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { AppUser } from '@shared/ipc'
import { api } from '../api'
import { useTheme } from '../theme'

const { isDark, toggleTheme, applyTheme } = useTheme()
const users = ref<AppUser[]>([])
const currentUser = ref<AppUser | null>(null)
const newUserName = ref('')
const aiSettings = ref<{ configured: boolean; model: string | null }>({ configured: false, model: null })
const aiApiKeyInput = ref('')
const aiModelInput = ref('gpt-5')
const aiBusy = ref(false)
const actionError = ref('')
const actionNotice = ref('')

onMounted(load)

async function load(): Promise<void> {
  applyTheme()
  currentUser.value = await api.getCurrentUser()
  users.value = await api.listUsers()
  aiSettings.value = await api.getAiSettingsStatus()
  aiModelInput.value = aiSettings.value.model ?? 'gpt-5'
}

async function switchUser(event: Event): Promise<void> {
  const userId = (event.target as HTMLSelectElement).value
  await api.switchUser(userId)
  window.location.reload()
}

async function createUser(): Promise<void> {
  const name = newUserName.value.trim()
  if (!name) return
  await api.createUser(name)
  window.location.reload()
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
  aiBusy.value = true
  try {
    aiSettings.value = await api.saveAiSettings({
      provider: 'openai',
      apiKey: aiApiKeyInput.value,
      model: aiModelInput.value.trim() || 'gpt-5'
    })
    aiModelInput.value = aiSettings.value.model ?? 'gpt-5'
    aiApiKeyInput.value = ''
    actionNotice.value = 'KI-Einstellungen gespeichert.'
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : String(error)
  } finally {
    aiBusy.value = false
  }
}

function setLightTheme(): void {
  if (isDark.value) toggleTheme()
}

function setDarkTheme(): void {
  if (!isDark.value) toggleTheme()
}
</script>
