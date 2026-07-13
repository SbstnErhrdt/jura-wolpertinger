import type { SyncRunAction, SyncStatus } from '@shared/schemas'

export type WorkspaceSyncMode = 'local' | 'online'
export type WorkspaceSyncTone = 'neutral' | 'success' | 'warning' | 'danger'

export type WorkspaceSyncModeOption = {
  id: WorkspaceSyncMode
  title: string
  description: string
  detail: string
  primaryAction: string
}

export type WorkspaceSyncStatusView = {
  badge: string
  title: string
  description: string
  detail: string
  tone: WorkspaceSyncTone
}

export type WorkspaceSyncActionView = {
  action: SyncRunAction
  label: string
  title: string
  description: string
  confirmButton: string
}

export function getWorkspaceSyncModeOptions(): WorkspaceSyncModeOption[] {
  return [
    {
      id: 'local',
      title: 'Auf diesem Gerät starten',
      description: 'Ohne Konto starten. Deine Daten bleiben auf diesem Gerät.',
      detail: 'Du kannst die Online-Sicherung später jederzeit einrichten.',
      primaryAction: 'Lokal starten'
    },
    {
      id: 'online',
      title: 'Mit Online-Sicherung starten',
      description: 'Kostenloses Konto verbinden und deinen Arbeitsbereich online sichern.',
      detail: 'Du kannst danach auch auf anderen Geräten weiterarbeiten.',
      primaryAction: 'Online-Sicherung einrichten'
    }
  ]
}

export function getSyncStatusView(status: SyncStatus, now = new Date()): WorkspaceSyncStatusView {
  if (!status.connected) {
    return {
      badge: 'Nur auf diesem Gerät',
      title: 'Noch nicht online gesichert',
      description: 'Dieser Arbeitsbereich liegt nur auf diesem Gerät. Du kannst ihn jederzeit online sichern.',
      detail: 'Keine Online-Sicherung eingerichtet.',
      tone: 'neutral'
    }
  }

  if (!status.lastSyncedAt) {
    return {
      badge: 'Online verbunden',
      title: 'Bereit zum ersten Abgleich',
      description: `Dein Arbeitsbereich ist mit ${status.remoteEmail ?? 'deinem Online-Konto'} verbunden.`,
      detail: 'Noch keine Synchronisierung durchgeführt.',
      tone: 'warning'
    }
  }

  return {
    badge: 'Online gesichert',
    title: 'Alles gesichert',
    description: `Dein Arbeitsbereich ist mit ${status.remoteEmail ?? 'deinem Online-Konto'} verbunden.`,
    detail: `Zuletzt synchronisiert: ${formatSyncDateTime(status.lastSyncedAt, now)}.`,
    tone: 'success'
  }
}

export function getWorkspaceSyncActions(): WorkspaceSyncActionView[] {
  return [
    {
      action: 'merge',
      label: 'Alles abgleichen',
      title: 'Alles abgleichen?',
      description: 'Die App prüft Änderungen in beide Richtungen und stoppt, wenn du entscheiden musst.',
      confirmButton: 'Jetzt abgleichen'
    },
    {
      action: 'upload',
      label: 'Online sichern',
      title: 'Diesen Arbeitsbereich online sichern?',
      description: 'Daten von diesem Gerät werden online gesichert und ersetzen die dortige Sicherung dieses Arbeitsbereichs.',
      confirmButton: 'Online sichern'
    },
    {
      action: 'download',
      label: 'Auf dieses Gerät holen',
      title: 'Online gesicherte Daten auf dieses Gerät holen?',
      description: 'Die online gesicherten Daten werden auf dieses Gerät geladen und ersetzen lokale Daten dieses Arbeitsbereichs.',
      confirmButton: 'Auf dieses Gerät holen'
    }
  ]
}

export function getWorkspaceSyncAction(action: SyncRunAction): WorkspaceSyncActionView {
  return getWorkspaceSyncActions().find((candidate) => candidate.action === action) ?? getWorkspaceSyncActions()[0]
}

function formatSyncDateTime(value: string, now: Date): string {
  const date = new Date(value)
  const sameDay = date.toDateString() === now.toDateString()
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: sameDay ? undefined : 'short',
    timeStyle: 'short'
  }).format(date)
}
