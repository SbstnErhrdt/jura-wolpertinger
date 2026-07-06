import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppServices } from '@main/services/services'
import { createWorkspaceSnapshot, restoreWorkspaceSnapshot } from '@main/services/syncService'
import type { CloudLearningSyncState } from '@main/services/learningSyncService'
import { EDITOR_SCHEMA_VERSION } from '@shared/constants'

let dataDir: string
let services: AppServices

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'jura-sync-service-'))
  services = new AppServices(dataDir)
})

afterEach(async () => {
  services?.close()
  await rm(dataDir, { recursive: true, force: true })
})

describe('workspace sync snapshots', () => {
  it('does not report an active online connection when only remembered account metadata exists', () => {
    services.db
      .prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)')
      .run('sync_remote_user_id', '00000000-0000-4000-8000-0000000000a1')
    services.db
      .prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)')
      .run('sync_remote_email', 'person@example.test')

    expect(services.getSyncStatus()).toEqual({
      connected: false,
      remoteUserId: '00000000-0000-4000-8000-0000000000a1',
      remoteEmail: 'person@example.test',
      lastSyncedAt: null,
      lastSyncSummary: null
    })
  })

  it('captures and restores exams, files, corrections, tasks and flashcards without AI secrets', async () => {
    const user = services.getCurrentUser()
    const folder = services.createFolder('Zivilrecht')
    const exam = services.createExam({
      title: 'Schuldrecht',
      folderId: folder.id,
      tags: ['zivilrecht']
    })
    services.saveRevision(exam.id, {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Anspruch entstanden.' }] }]
    })
    const sourceFile = join(dataDir, 'quelle.pdf')
    await writeFile(sourceFile, Buffer.from('pdf-content'))
    const attachment = await services.addAttachmentFromPath(exam.id, sourceFile, 'assignment')
    const submission = services.submitExam(exam.id)
    const correction = services.createCorrection(submission.id)
    services.updateCorrection({
      correctionId: correction.id,
      scorePoints: 8,
      gradingComment: 'Ordentlich.',
      tags: ['aufbau']
    })
    services.addInlineComment({
      correctionId: correction.id,
      submissionId: submission.id,
      body: 'Hier genauer subsumieren.',
      tags: ['subsumtion'],
      anchor: {
        type: 'prosemirror-selection',
        editorSchemaVersion: EDITOR_SCHEMA_VERSION,
        from: 0,
        to: 8,
        selectedText: 'Anspruch',
        prefix: '',
        suffix: ' entstanden.',
        contentHash: submission.contentHash
      }
    })
    const collection = services.createLearningCollection({ name: 'BGB AT' })
    const card = services.createLearningCard({
      collectionId: collection.id,
      title: 'Willenserklärung',
      frontMarkdown: 'Was ist eine Willenserklärung?',
      backMarkdown: 'Äußerung eines Rechtsfolgewillens.',
      tags: ['bgb']
    })
    services.recordReview({ cardId: card.id, rating: 3, elapsedMs: 1200 })
    services.saveAiSettings({ provider: 'openai', apiKey: 'sk-secret', model: 'gpt-5.5' })

    const snapshot = createWorkspaceSnapshot({
      db: services.db,
      filesDir: services.filesDir,
      localUserId: user.id,
      remoteUserId: '00000000-0000-4000-8000-0000000000a1'
    })

    expect(snapshot.tables.exams).toHaveLength(1)
    expect(snapshot.tables.attachments).toHaveLength(1)
    expect(snapshot.files).toEqual([
      expect.objectContaining({
        attachmentId: attachment.id,
        storagePath: expect.stringContaining(`/attachments/${attachment.id}/`)
      })
    ])
    expect(snapshot.tables.ai_settings).toBeUndefined()
    expect(snapshot.tables.ai_correction_drafts).toBeUndefined()

    services.close()
    const restoreDir = await mkdtemp(join(tmpdir(), 'jura-sync-restore-'))
    const restoredServices = new AppServices(restoreDir)
    try {
      restoreWorkspaceSnapshot({
        db: restoredServices.db,
        snapshot,
        targetUserId: user.id
      })

      expect(restoredServices.listExams()).toEqual([
        expect.objectContaining({ title: 'Schuldrecht', tags: ['zivilrecht'] })
      ])
      expect(restoredServices.listLearningCollections()).toEqual([
        expect.objectContaining({ name: 'BGB AT', cardCount: 1 })
      ])
      expect(restoredServices.listLearningCards()).toEqual([
        expect.objectContaining({ title: 'Willenserklärung', tags: ['bgb'], reps: 1 })
      ])
      expect(restoredServices.getAiSettingsStatus().configured).toBe(false)
    } finally {
      restoredServices.close()
      await rm(restoreDir, { recursive: true, force: true })
    }
  })

  it('merges cloud flashcards during the normal all-data sync flow', async () => {
    const user = services.getCurrentUser()
    const collection = services.createLearningCollection({ name: 'BGB AT' })
    const card = services.createLearningCard({
      collectionId: collection.id,
      title: 'Lokal',
      frontMarkdown: 'Alt?',
      backMarkdown: 'Alt.',
      tags: ['lokal']
    })
    services.db.prepare('UPDATE learning_collections SET updated_at = ? WHERE id = ?').run(
      '2026-01-01T00:00:00.000Z',
      collection.id
    )
    services.db.prepare('UPDATE learning_cards SET updated_at = ? WHERE id = ?').run(
      '2026-01-01T00:00:00.000Z',
      card.id
    )
    services.db
      .prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)')
      .run('sync_remote_user_id', '00000000-0000-4000-8000-0000000000a1')

    const uploadedLearningStates: CloudLearningSyncState[] = []
    const fakeClient = {
      async downloadLatestSnapshot() {
        return null
      },
      async downloadLearningState(): Promise<CloudLearningSyncState> {
        return {
          collections: [
            {
              id: collection.id,
              ownerUserId: '00000000-0000-4000-8000-0000000000a1',
              name: 'BGB Allgemeiner Teil',
              description: '',
              subject: null,
              source: null,
              isArchived: false,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-02-01T00:00:00.000Z'
            }
          ],
          cards: [
            {
              id: card.id,
              itemId: '10000000-0000-4000-8000-000000000001',
              collectionId: collection.id,
              ownerUserId: '00000000-0000-4000-8000-0000000000a1',
              title: 'Online',
              externalId: card.id,
              frontMarkdown: 'Neu?',
              backMarkdown: 'Neu.',
              tags: ['cloud'],
              isArchived: false,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-02-01T00:00:00.000Z'
            }
          ],
          schedules: [],
          reviewEvents: []
        }
      },
      async uploadLearningState(state: CloudLearningSyncState) {
        uploadedLearningStates.push(state)
      },
      async uploadSnapshot() {},
      async uploadFile() {}
    }
    ;(services as unknown as { syncClient: typeof fakeClient }).syncClient = fakeClient

    const result = await services.runSync({ action: 'merge' })

    expect(result.summary).toContain('abgeglichen')
    expect(services.listLearningCollections().find((candidate) => candidate.id === collection.id)?.name).toBe(
      'BGB Allgemeiner Teil'
    )
    expect(services.listLearningCards().find((candidate) => candidate.id === card.id)).toEqual(
      expect.objectContaining({ title: 'Online', frontMarkdown: 'Neu?', tags: ['cloud'] })
    )
    expect(uploadedLearningStates).toHaveLength(1)
    expect(uploadedLearningStates[0].cards).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: card.id, title: 'Online' })])
    )
    expect(user.id).toBe(services.getCurrentUser().id)
  })
})
