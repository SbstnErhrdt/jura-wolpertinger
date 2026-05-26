import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EDITOR_SCHEMA_VERSION } from '../../src/shared/constants'
import type { AppApi } from '../../src/shared/ipc'

type LocalStorageMock = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
  clear: () => void
}

const storage = new Map<string, string>()
const browserStoreKey = 'jura-wolpertinger-browser-dev-v1'
const localStorageMock: LocalStorageMock = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear()
}

describe('browser development API', () => {
  beforeEach(() => {
    storage.clear()
    vi.resetModules()
    vi.stubGlobal('window', {})
    vi.stubGlobal('localStorage', localStorageMock)
  })

  it('does not persist OpenAI API keys in localStorage', async () => {
    const apiModulePath = '../../src/renderer/src/api'
    const { getApi } = (await import(/* @vite-ignore */ apiModulePath)) as {
      getApi: () => AppApi
    }
    const api = getApi()

    const status = await api.saveAiSettings({
      provider: 'openai',
      apiKey: 'sk-test-secret',
      model: 'gpt-5'
    })

    expect(status.configured).toBe(true)
    expect(localStorageMock.getItem(browserStoreKey)).not.toContain('sk-test-secret')
    expect(localStorageMock.getItem(browserStoreKey)).not.toContain('apiKey')
  })

  it('keeps browser dev AI settings configured when the saved key field is left empty', async () => {
    const apiModulePath = '../../src/renderer/src/api'
    const { getApi } = (await import(/* @vite-ignore */ apiModulePath)) as {
      getApi: () => AppApi
    }
    const api = getApi()

    await api.saveAiSettings({
      provider: 'openai',
      apiKey: 'sk-test-secret',
      model: 'gpt-5.5'
    })
    const status = await api.saveAiSettings({
      provider: 'openai',
      apiKey: ' ',
      model: 'gpt-5.5'
    })

    expect(status.configured).toBe(true)
    expect(localStorageMock.getItem(browserStoreKey)).not.toContain('sk-test-secret')
  })

  it('keeps accepted AI inline comments in the normal correction', async () => {
    const apiModulePath = '../../src/renderer/src/api'
    const { getApi } = (await import(/* @vite-ignore */ apiModulePath)) as {
      getApi: () => AppApi
    }
    const now = '2026-05-24T12:00:00.000Z'
    const userId = '11111111-1111-4111-8111-111111111111'
    const examId = '66666666-6666-4666-8666-666666666666'
    const revisionId = '77777777-7777-4777-8777-777777777777'
    const submissionId = '22222222-2222-4222-8222-222222222222'
    const correctionId = '33333333-3333-4333-8333-333333333333'
    const draftId = '44444444-4444-4444-8444-444444444444'
    localStorageMock.setItem(
      browserStoreKey,
      JSON.stringify({
        users: [
          {
            id: userId,
            displayName: 'Lokaler Nutzer',
            kind: 'local',
            remoteUserId: null,
            onboardingCompletedAt: null,
            tourCompletedAt: null,
            createdAt: now,
            updatedAt: now
          }
        ],
        currentUserId: userId,
        folders: [],
        exams: [
          {
            id: examId,
            userId,
            title: 'KI Klausur',
            folderId: null,
            status: 'submitted',
            tags: [],
            notes: '',
            legalArea: null,
            examType: null,
            sourceName: null,
            sourceUrl: null,
            currentRevisionId: revisionId,
            createdAt: now,
            updatedAt: now,
            lastSavedAt: now,
            latestScore: null
          }
        ],
        revisions: [
          {
            schemaVersion: 1,
            id: revisionId,
            userId,
            examId,
            createdAt: now,
            kind: 'submission',
            contentFormat: 'tiptap-v1',
            contentHash: 'hash-1',
            content: {
              type: 'doc',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Anspruch entstanden.' }] }]
            }
          }
        ],
        submissions: [
          {
            schemaVersion: 1,
            id: submissionId,
            userId,
            examId,
            submittedAt: now,
            revisionId,
            contentHash: 'hash-1',
            canContinueEditing: true,
            pdfPath: null
          }
        ],
        attachments: [],
        corrections: [
          {
            schemaVersion: 1,
            id: correctionId,
            userId,
            targetSubmissionId: submissionId,
            createdAt: now,
            updatedAt: now,
            score: { system: 'bayern-0-18', points: null },
            gradingComment: '',
            tags: [],
            inlineComments: [
              {
                schemaVersion: 1,
                id: '55555555-5555-4555-8555-555555555555',
                userId,
                targetSubmissionId: submissionId,
                correctionId,
                createdAt: now,
                status: 'open',
                body: 'Manueller Kommentar',
                anchor: {
                  type: 'prosemirror-selection',
                  editorSchemaVersion: EDITOR_SCHEMA_VERSION,
                  from: 0,
                  to: 8,
                  selectedText: 'Anspruch',
                  prefix: '',
                  suffix: ' entstanden.',
                  contentHash: 'hash-1'
                },
                tags: []
              }
            ]
          }
        ],
        aiSettings: null,
        aiCorrectionDrafts: [
          {
            schemaVersion: 1,
            id: draftId,
            userId,
            submissionId,
            correctionId: null,
            status: 'draft',
            provider: 'openai',
            model: 'gpt-5',
            promptVersion: 'ai-correction-v1',
            createdAt: now,
            updatedAt: now,
            score: { system: 'bayern-0-18', points: 8 },
            scoreReasoning: 'Reasoning',
            gradingComment: 'Kommentar',
            strengths: [],
            weaknesses: [],
            tags: [],
            confidence: 'medium',
            improvementSuggestions: [],
            inlineComments: [
              {
                selectedText: 'entstanden',
                prefix: 'Anspruch ',
                suffix: '.',
                body: 'KI-Kommentar',
                tags: ['ki']
              },
              {
                selectedText: 'Halluzination',
                prefix: '',
                suffix: '',
                body: 'Unverankerter KI-Kommentar',
                tags: ['ki']
              }
            ]
          }
        ],
        learningTasks: []
      })
    )

    const api = getApi()
    await api.acceptAiCorrectionDraft(draftId)

    const stored = JSON.parse(localStorageMock.getItem(browserStoreKey) ?? '{}') as {
      corrections: Array<{
        inlineComments: Array<{
          body: string
          correctionId: string
          targetSubmissionId: string
          status: string
          tags: string[]
          anchor: { selectedText: string; contentHash: string }
        }>
      }>
    }

    expect(stored.corrections[0].inlineComments).toHaveLength(2)
    expect(
      stored.corrections[0].inlineComments.some(
        (comment) => comment.body === 'Unverankerter KI-Kommentar'
      )
    ).toBe(false)
    expect(stored.corrections[0].inlineComments).toEqual([
      expect.objectContaining({ body: 'Manueller Kommentar' }),
      expect.objectContaining({
        body: 'KI-Kommentar',
        correctionId,
        targetSubmissionId: submissionId,
        status: 'open',
        tags: ['ki'],
        anchor: expect.objectContaining({
          selectedText: 'entstanden',
          contentHash: 'hash-1'
        })
      })
    ])
  })

  it('isolates learning tasks by current user in the browser fallback', async () => {
    const apiModulePath = '../../src/renderer/src/api'
    const { getApi } = (await import(/* @vite-ignore */ apiModulePath)) as {
      getApi: () => AppApi
    }
    const now = '2026-05-24T12:00:00.000Z'
    const currentUserId = '11111111-1111-4111-8111-111111111111'
    const otherUserId = '22222222-2222-4222-8222-222222222222'
    const currentTaskId = '33333333-3333-4333-8333-333333333333'
    const otherTaskId = '44444444-4444-4444-8444-444444444444'
    localStorageMock.setItem(
      browserStoreKey,
      JSON.stringify({
        users: [
          {
            id: currentUserId,
            displayName: 'Nutzer A',
            kind: 'local',
            remoteUserId: null,
            onboardingCompletedAt: null,
            tourCompletedAt: null,
            createdAt: now,
            updatedAt: now
          },
          {
            id: otherUserId,
            displayName: 'Nutzer B',
            kind: 'local',
            remoteUserId: null,
            onboardingCompletedAt: null,
            tourCompletedAt: null,
            createdAt: now,
            updatedAt: now
          }
        ],
        currentUserId,
        folders: [],
        exams: [],
        revisions: [],
        submissions: [],
        attachments: [],
        corrections: [],
        aiSettings: null,
        aiCorrectionDrafts: [],
        learningTasks: [
          {
            schemaVersion: 1,
            id: currentTaskId,
            userId: currentUserId,
            submissionId: '55555555-5555-4555-8555-555555555555',
            correctionId: null,
            aiDraftId: null,
            category: 'structure',
            priority: 'high',
            status: 'open',
            title: 'Eigene Aufgabe',
            detail: 'Aufbau wiederholen.',
            createdAt: now,
            updatedAt: now
          },
          {
            schemaVersion: 1,
            id: otherTaskId,
            userId: otherUserId,
            submissionId: '66666666-6666-4666-8666-666666666666',
            correctionId: null,
            aiDraftId: null,
            category: 'law',
            priority: 'medium',
            status: 'open',
            title: 'Fremde Aufgabe',
            detail: 'Definition wiederholen.',
            createdAt: now,
            updatedAt: now
          }
        ]
      })
    )

    const api = getApi()

    expect(await api.listLearningTasks()).toEqual([expect.objectContaining({ id: currentTaskId })])
    await expect(api.updateLearningTaskStatus(otherTaskId, 'done')).rejects.toThrow(/Learning task not found/i)

    const updated = await api.updateLearningTaskStatus(currentTaskId, 'done')

    expect(updated.status).toBe('done')
    expect(await api.listLearningTasks()).toEqual([expect.objectContaining({ id: currentTaskId, status: 'done' })])
  })
})
