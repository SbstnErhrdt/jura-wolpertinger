import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppApi } from '../../src/shared/ipc'

type QueryCall = {
  table: string
  operation: 'select' | 'eq' | 'in' | 'order'
  column?: string
  value?: unknown
}

type RpcCall = {
  name: string
  args: Record<string, unknown>
}

const now = '2026-07-05T12:00:00.000Z'
const userId = '11111111-1111-4111-8111-111111111111'
const collectionId = '22222222-2222-4222-8222-222222222222'

let queryCalls: QueryCall[] = []
let rpcCalls: RpcCall[] = []
let tableData: Record<string, unknown[]> = {}

describe('cloud learning API', () => {
  beforeEach(() => {
    queryCalls = []
    rpcCalls = []
    tableData = {}
    vi.resetModules()
  })

  it('loads cloud review batches through RPC and chunks follow-up ID queries', async () => {
    const batchSize = 125
    const prompts = Array.from({ length: batchSize }, (_, index) => ({
      prompt_id: uuidFor(index, 'prompt'),
      item_id: uuidFor(index, 'item'),
      collection_id: collectionId,
      front_markdown: `Vorderseite ${index + 1}`,
      back_markdown: `Rueckseite ${index + 1}`,
      due_at: now
    }))
    tableData = {
      learning_items: prompts.map((prompt, index) => ({
        id: prompt.item_id,
        primary_collection_id: collectionId,
        owner_user_id: userId,
        title: `Karte ${index + 1}`,
        external_id: `card-${index + 1}`,
        is_archived: false,
        created_at: now,
        updated_at: now
      })),
      learning_prompt_schedules: prompts.map((prompt) => ({
        prompt_id: prompt.prompt_id,
        due_at: now,
        reps: 0,
        lapses: 0,
        last_rating: null
      })),
      learning_item_tags: []
    }

    const authModulePath = '../../src/renderer/src/cloudAuth'
    vi.doMock(authModulePath, () => ({
      getSupabaseAuthClient: () => createSupabaseClientMock()
    }))
    const apiModulePath = '../../src/renderer/src/cloudLearningApi'
    const { createCloudLearningApi } = (await import(/* @vite-ignore */ apiModulePath)) as {
      createCloudLearningApi: (localApi: AppApi) => AppApi
    }
    const api = createCloudLearningApi(createLocalApiStub())
    const cards = await api.getReviewBatch({ limit: 100 })

    expect(cards).toHaveLength(batchSize)
    expect(rpcCalls).toEqual([
      {
        name: 'get_review_batch',
        args: {
          p_collection_ids: null,
          p_tag_ids: null,
          p_limit: 100,
          p_exclude_prompt_ids: []
        }
      }
    ])

    const inCalls = queryCalls.filter((call) => call.operation === 'in')
    expect(inCalls.length).toBeGreaterThan(0)
    expect(inCalls.every((call) => Array.isArray(call.value) && call.value.length <= 50)).toBe(true)
    expect(
      queryCalls.some((call) => (
        call.table === 'learning_items' &&
        call.operation === 'eq' &&
        call.column === 'owner_user_id'
      ))
    ).toBe(false)
  })

  it('loads collection summaries without fetching card details', async () => {
    tableData = {
      learning_collections: [
        {
          id: collectionId,
          owner_user_id: userId,
          name: 'Strafrecht',
          description_markdown: '',
          subject: 'Strafrecht',
          source: null,
          card_count: 301,
          due_count: 301,
          created_at: now,
          updated_at: now
        }
      ]
    }

    const authModulePath = '../../src/renderer/src/cloudAuth'
    vi.doMock(authModulePath, () => ({
      getSupabaseAuthClient: () => createSupabaseClientMock()
    }))
    const apiModulePath = '../../src/renderer/src/cloudLearningApi'
    const { createCloudLearningApi } = (await import(/* @vite-ignore */ apiModulePath)) as {
      createCloudLearningApi: (localApi: AppApi) => AppApi
    }
    const api = createCloudLearningApi(createLocalApiStub())
    const collections = await api.listLearningCollections()

    expect(collections).toMatchObject([
      {
        id: collectionId,
        cardCount: 301,
        dueCount: 301
      }
    ])
    expect(rpcCalls.map((call) => call.name)).toEqual(['get_learning_collection_summaries'])
    expect(queryCalls.some((call) => call.table === 'learning_items')).toBe(false)
    expect(queryCalls.some((call) => call.table === 'learning_prompts')).toBe(false)
  })
})

function createSupabaseClientMock() {
  return {
    auth: {
      async getSession() {
        return {
          data: {
            session: {
              user: {
                id: userId,
                email: 'learner@example.test',
                created_at: now,
                updated_at: now,
                user_metadata: {}
              }
            }
          },
          error: null
        }
      }
    },
    async rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args })
      if (name === 'get_review_batch') {
        return {
          data: tableData.learning_items.map((item, index) => ({
            prompt_id: uuidFor(index, 'prompt'),
            item_id: String((item as { id: string }).id),
            collection_id: collectionId,
            front_markdown: `Vorderseite ${index + 1}`,
            back_markdown: `Rueckseite ${index + 1}`,
            due_at: now
          })),
          error: null
        }
      }
      if (name === 'get_learning_collection_summaries') {
        return {
          data: tableData.learning_collections,
          error: null
        }
      }
      if (name === 'get_learning_dashboard_summary') {
        return {
          data: {
            due_count: 301,
            total_cards: 301,
            collection_count: 1
          },
          error: null
        }
      }
      if (name === 'record_review') {
        return {
          data: {
            event_id: uuidFor(999, 'event'),
            due_at: now,
            reps: 1,
            lapses: 0
          },
          error: null
        }
      }
      return { data: null, error: null }
    },
    from(table: string) {
      return createQueryBuilder(table)
    }
  }
}

function createQueryBuilder(table: string) {
  let rows = [...(tableData[table] ?? [])]
  const builder = {
    select(_columns: string) {
      queryCalls.push({ table, operation: 'select' })
      return builder
    },
    eq(column: string, value: unknown) {
      queryCalls.push({ table, operation: 'eq', column, value })
      rows = rows.filter((row) => (row as Record<string, unknown>)[column] === value)
      return builder
    },
    in(column: string, value: unknown[]) {
      queryCalls.push({ table, operation: 'in', column, value })
      const allowed = new Set(value)
      rows = rows.filter((row) => allowed.has((row as Record<string, unknown>)[column]))
      return builder
    },
    order(column: string) {
      queryCalls.push({ table, operation: 'order', column })
      return builder
    },
    async returns<T>() {
      return { data: rows as T, error: null }
    }
  }
  return builder
}

function createLocalApiStub(): AppApi {
  return {
    getCurrentUser: unimplemented,
    listUsers: unimplemented,
    createUser: unimplemented,
    updateUser: unimplemented,
    switchUser: unimplemented,
    completeOnboarding: unimplemented,
    completeTour: unimplemented,
    resetTour: unimplemented,
    listFolders: unimplemented,
    createFolder: unimplemented,
    updateFolder: unimplemented,
    trashFolder: unimplemented,
    restoreFolder: unimplemented,
    listExams: unimplemented,
    createExam: unimplemented,
    getExam: unimplemented,
    updateExam: unimplemented,
    trashExam: unimplemented,
    restoreExam: unimplemented,
    saveRevision: unimplemented,
    submitExam: unimplemented,
    getSubmission: unimplemented,
    listAnalyticsEntries: unimplemented,
    getAiSettingsStatus: unimplemented,
    saveAiSettings: unimplemented,
    removeAiSettings: unimplemented,
    testAiConnection: unimplemented,
    generateAiCorrectionDraft: unimplemented,
    listAiCorrectionDrafts: unimplemented,
    acceptAiCorrectionDraft: unimplemented,
    rejectAiCorrectionDraft: unimplemented,
    listLearningTasks: unimplemented,
    updateLearningTaskStatus: unimplemented,
    getLearningDashboard: unimplemented,
    exportLearningDecksJson: unimplemented,
    importLearningDecksJson: unimplemented,
    listLearningCollections: unimplemented,
    createLearningCollection: unimplemented,
    listLearningCards: unimplemented,
    createLearningCard: unimplemented,
    updateLearningCard: unimplemented,
    getReviewBatch: unimplemented,
    recordReview: unimplemented,
    addAttachment: unimplemented,
    openAttachment: unimplemented,
    exportExamPackage: unimplemented,
    importExamPackage: unimplemented,
    exportExamPdf: unimplemented,
    createCorrection: unimplemented,
    updateCorrection: unimplemented,
    addInlineComment: unimplemented
  }
}

function unimplemented(): never {
  throw new Error('Unexpected local fallback call')
}

function uuidFor(index: number, kind: 'item' | 'prompt' | 'event'): string {
  const prefix = kind === 'item' ? '10000000' : kind === 'prompt' ? '20000000' : '30000000'
  return `${prefix}-0000-4000-8000-${String(index).padStart(12, '0')}`
}
