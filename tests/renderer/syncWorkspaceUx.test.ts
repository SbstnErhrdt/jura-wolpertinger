import { describe, expect, it } from 'vitest'
import {
  getSyncStatusView,
  getWorkspaceSyncActions,
  getWorkspaceSyncModeOptions
} from '@renderer/syncWorkspaceUx'
import type { SyncStatus } from '@shared/schemas'

const disconnected: SyncStatus = {
  connected: false,
  remoteUserId: null,
  remoteEmail: null,
  lastSyncedAt: null,
  lastSyncSummary: null
}

describe('workspace sync UX model', () => {
  it('explains first-start choices without technical wording', () => {
    const options = getWorkspaceSyncModeOptions()

    expect(options).toEqual([
      expect.objectContaining({
        id: 'local',
        title: 'Auf diesem Gerät starten',
        primaryAction: 'Lokal starten'
      }),
      expect.objectContaining({
        id: 'online',
        title: 'Mit Online-Sicherung starten',
        primaryAction: 'Online-Sicherung einrichten'
      })
    ])
    expect(JSON.stringify(options)).not.toMatch(/Supabase|API|JSON|Storage|remote_user_id/i)
  })

  it('shows a clear local-only sync status', () => {
    expect(getSyncStatusView(disconnected)).toEqual({
      badge: 'Nur auf diesem Gerät',
      title: 'Noch nicht online gesichert',
      description: 'Dieser Arbeitsbereich liegt nur auf diesem Gerät. Du kannst ihn jederzeit online sichern.',
      detail: 'Keine Online-Sicherung eingerichtet.',
      tone: 'neutral'
    })
  })

  it('shows the latest sync time for connected workspaces', () => {
    expect(
      getSyncStatusView({
        connected: true,
        remoteUserId: 'remote-1',
        remoteEmail: 'lernen@example.test',
        lastSyncedAt: '2026-07-13T08:30:00.000Z',
        lastSyncSummary: 'Alles wurde abgeglichen.'
      })
    ).toEqual({
      badge: 'Online gesichert',
      title: 'Alles gesichert',
      description: 'Dein Arbeitsbereich ist mit lernen@example.test verbunden.',
      detail: expect.stringContaining('Zuletzt synchronisiert:'),
      tone: 'success'
    })
  })

  it('uses user-facing sync action names and explains direction', () => {
    const actions = getWorkspaceSyncActions()

    expect(actions.map((action) => action.label)).toEqual([
      'Alles abgleichen',
      'Online sichern',
      'Auf dieses Gerät holen'
    ])
    expect(actions[0].description).toContain('beide Richtungen')
    expect(actions[1].description).toContain('von diesem Gerät')
    expect(actions[2].description).toContain('auf dieses Gerät')
    const visibleText = actions.map(({ label, title, description, confirmButton }) => ({
      label,
      title,
      description,
      confirmButton
    }))
    expect(JSON.stringify(visibleText)).not.toMatch(/upload|download|merge|snapshot|bucket|RLS/i)
  })
})
