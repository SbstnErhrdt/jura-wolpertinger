import type { MenuItemConstructorOptions } from 'electron'

export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000
export const UPDATE_MENU_LABEL = 'Nach Updates suchen...'

export interface UpdateNotification {
  type: 'info' | 'error'
  title: string
  message: string
}

export interface AutoUpdateCoordinatorInput {
  checkForUpdates(): Promise<unknown>
  notify(notification: UpdateNotification): void | Promise<void>
  setTimeout(callback: () => void, delayMs: number): unknown
  setInterval(callback: () => void, delayMs: number): unknown
}

export interface AutoUpdateCoordinator {
  checkNow(): Promise<void>
  checkInBackground(): Promise<void>
  scheduleBackgroundChecks(initialDelayMs: number): void
}

export function createAutoUpdateCoordinator({
  checkForUpdates,
  notify,
  setTimeout,
  setInterval
}: AutoUpdateCoordinatorInput): AutoUpdateCoordinator {
  let isChecking = false

  async function runCheck(mode: 'manual' | 'background'): Promise<void> {
    if (isChecking) return
    isChecking = true

    try {
      const result = await checkForUpdates()
      if (mode === 'manual' && !result) {
        await notify({
          type: 'info',
          title: 'Keine Aktualisierung gefunden',
          message: 'Du nutzt bereits die aktuelle Version von Jura Wolpertinger.'
        })
      }
    } catch {
      if (mode === 'manual') {
        await notify({
          type: 'error',
          title: 'Aktualisierung konnte nicht geprüft werden',
          message: 'Bitte prüfe deine Internetverbindung und versuche es später erneut.'
        })
      }
    } finally {
      isChecking = false
    }
  }

  return {
    checkNow: () => runCheck('manual'),
    checkInBackground: () => runCheck('background'),
    scheduleBackgroundChecks(initialDelayMs: number): void {
      setTimeout(() => {
        void runCheck('background')
      }, initialDelayMs)
      setInterval(() => {
        void runCheck('background')
      }, UPDATE_CHECK_INTERVAL_MS)
    }
  }
}

export interface CreateUpdateMenuTemplateInput {
  platform: NodeJS.Platform
  appName: string
  checkForUpdates(): void
}

export function createUpdateMenuTemplate({
  platform,
  appName,
  checkForUpdates
}: CreateUpdateMenuTemplateInput): MenuItemConstructorOptions[] {
  const updateMenuItem: MenuItemConstructorOptions = {
    label: UPDATE_MENU_LABEL,
    click: checkForUpdates
  }

  if (platform === 'darwin') {
    return [
      {
        label: appName,
        submenu: [
          { role: 'about', label: `Über ${appName}` },
          updateMenuItem,
          { type: 'separator' },
          { role: 'services', label: 'Dienste' },
          { type: 'separator' },
          { role: 'hide', label: `${appName} ausblenden` },
          { role: 'hideOthers', label: 'Andere ausblenden' },
          { role: 'unhide', label: 'Alle einblenden' },
          { type: 'separator' },
          { role: 'quit', label: `${appName} beenden` }
        ]
      },
      { role: 'editMenu', label: 'Bearbeiten' },
      { role: 'viewMenu', label: 'Ansicht' },
      { role: 'windowMenu', label: 'Fenster' }
    ]
  }

  return [
    { role: 'fileMenu', label: 'Datei' },
    { role: 'editMenu', label: 'Bearbeiten' },
    { role: 'viewMenu', label: 'Ansicht' },
    {
      label: 'Hilfe',
      submenu: [updateMenuItem]
    }
  ]
}
