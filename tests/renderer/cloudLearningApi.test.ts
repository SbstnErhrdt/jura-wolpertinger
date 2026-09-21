import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppApi, ExamDetails, ExamListItem } from '../../src/shared/ipc'
import type { Attachment, Correction, ExamRevision, InlineComment, Submission } from '../../src/shared/schemas'

type QueryCall = {
  table: string
  operation: 'select' | 'eq' | 'is' | 'in' | 'order' | 'range' | 'limit' | 'maybeSingle' | 'upsert'
  column?: string
  value?: unknown
  from?: number
  to?: number
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
let studyRpcResult: { data: unknown; error: unknown } = { data: null, error: null }
let statusCountsRpcResult: { data: unknown; error: unknown } = { data: [], error: null }
let upsertCalls: Array<{ table: string; value: Record<string, unknown>; options?: Record<string, unknown> }> = []
let sessionUserId = userId
let beforeSnapshotResponse: (() => void) | null = null
let downloadCalls: Array<{ bucket: string; path: string }> = []
let downloadResult: { data: Blob | null; error: Error | null } = { data: null, error: null }
let beforeDownloadResponse: (() => void) | null = null

const browserStoreKey = 'jura-wolpertinger-browser-dev-v1'

describe('cloud learning API', () => {
  beforeEach(() => {
    queryCalls = []
    rpcCalls = []
    tableData = {}
    studyRpcResult = { data: null, error: null }
    statusCountsRpcResult = { data: [], error: null }
    upsertCalls = []
    sessionUserId = userId
    beforeSnapshotResponse = null
    downloadCalls = []
    downloadResult = { data: new Blob(['pdf']), error: null }
    beforeDownloadResponse = null
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: createMemoryLocalStorage()
    })
    vi.resetModules()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('uses one study RPC with stable event identity and rejects malformed responses or save failures', async () => {
    const authModulePath = '../../src/renderer/src/cloudAuth'
    vi.doMock(authModulePath, () => ({ getSupabaseAuthClient: () => createSupabaseClientMock() }))
    const apiModulePath = '../../src/renderer/src/cloudLearningApi'
    const { createCloudLearningApi } = await import(/* @vite-ignore */ apiModulePath)
    const api: AppApi = createCloudLearningApi(createLocalApiStub())
    const command = { action: 'rate' as const, runId: collectionId, cardId: userId, rating: 1 as const, eventId: uuidFor(1, 'event') }
    studyRpcResult = { data: { overviews: [], run: null, cards: [], review: null }, error: null }
    await api.studyFlashcards(command)
    expect(rpcCalls).toEqual([{ name: 'study_flashcards', args: { p_command: command } }])
    expect(queryCalls).toEqual([])
    studyRpcResult = { data: { cards: [] }, error: null }
    await expect(api.studyFlashcards(command)).rejects.toThrow()
    studyRpcResult = { data: null, error: new Error('Verbindung unterbrochen') }
    await expect(api.studyFlashcards(command)).rejects.toThrow('Verbindung unterbrochen')
  })

  it('loads bounded searchable collection orientation from a dedicated RPC and requires its payload', async () => {
    vi.doMock('../../src/renderer/src/cloudAuth', () => ({ getSupabaseAuthClient: () => createSupabaseClientMock() }))
    const apiModulePath = '../../src/renderer/src/cloudLearningApi'
    const { createCloudLearningApi } = await import(/* @vite-ignore */ apiModulePath)
    const api: AppApi = createCloudLearningApi(createLocalApiStub())
    const catalog = { items: [], total: 0, collectionCount: 0, eligibleCollectionCount: 0, recommendation: null }
    studyRpcResult = { data: { overviews: [], run: null, cards: [], review: null, catalog }, error: null }
    expect((await api.studyFlashcards({ action: 'catalog', search: ' Bau% ', page: 2 })).catalog).toEqual(catalog)
    expect(rpcCalls).toEqual([
      { name: 'get_study_collection_catalog', args: { p_search: 'Bau%', p_page: 2 } },
      { name: 'get_learning_status_counts', args: {} }
    ])
    expect(queryCalls).toEqual([])
    studyRpcResult = { data: { overviews: [], run: null, cards: [], review: null }, error: null }
    await expect(api.studyFlashcards({ action: 'catalog' })).rejects.toThrow()
    studyRpcResult = { data: null, error: new Error('Verbindung unterbrochen') }
    await expect(api.studyFlashcards({ action: 'catalog' })).rejects.toThrow('Verbindung unterbrochen')
  })

  it('adds grouped learning status counts to cloud collection overviews', async () => {
    vi.doMock('../../src/renderer/src/cloudAuth', () => ({ getSupabaseAuthClient: () => createSupabaseClientMock() }))
    const apiModulePath = '../../src/renderer/src/cloudLearningApi'
    const { createCloudLearningApi } = await import(/* @vite-ignore */ apiModulePath)
    const api: AppApi = createCloudLearningApi(createLocalApiStub())
    const overview = {
      collectionId,
      totalCards: 5,
      eligibleCards: 5,
      reviewedCards: 4,
      newCards: 1,
      dueCards: 0,
      weakCards: 2,
      pausedCards: 0,
      activeRun: null
    }
    studyRpcResult = { data: { overviews: [overview], run: null, cards: [], review: null }, error: null }
    statusCountsRpcResult = {
      data: [{ collectionId, statusCounts: { notKnown: 1, partiallyKnown: 1, known: 2 } }],
      error: null
    }

    await expect(api.studyFlashcards({ action: 'overview', collectionId })).resolves.toMatchObject({
      overviews: [{ statusCounts: { notKnown: 1, partiallyKnown: 1, known: 2 } }]
    })
    expect(rpcCalls).toEqual([
      { name: 'study_flashcards', args: { p_command: { action: 'overview', collectionId } } },
      { name: 'get_learning_status_counts', args: {} }
    ])
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

  it('keeps future-suggested tagged cloud cards available after recommended cards', async () => {
    const future = '2999-01-01T00:00:00.000Z'
    tableData = {
      learning_items: [
        {
          id: uuidFor(1, 'item'),
          primary_collection_id: collectionId,
          owner_user_id: userId,
          title: 'Heute empfohlen',
          external_id: 'due-card',
          is_archived: false,
          created_at: now,
          updated_at: now
        },
        {
          id: uuidFor(2, 'item'),
          primary_collection_id: collectionId,
          owner_user_id: userId,
          title: 'Frei wiederholen',
          external_id: 'future-card',
          is_archived: false,
          created_at: now,
          updated_at: now
        }
      ],
      learning_prompts: [
        {
          id: uuidFor(1, 'prompt'),
          item_id: uuidFor(1, 'item'),
          front_markdown: 'Was ist eine Abmahnung?',
          back_markdown: 'Hinweis- und Warnfunktion.',
          is_archived: false,
          created_at: now,
          updated_at: now
        },
        {
          id: uuidFor(2, 'prompt'),
          item_id: uuidFor(2, 'item'),
          front_markdown: 'Wann ist das KSchG anwendbar?',
          back_markdown: 'Nach Wartezeit und Betriebsgröße.',
          is_archived: false,
          created_at: now,
          updated_at: now
        }
      ],
      learning_prompt_schedules: [
        {
          user_id: userId,
          prompt_id: uuidFor(1, 'prompt'),
          due_at: now,
          reps: 0,
          lapses: 0,
          last_rating: null
        },
        {
          user_id: userId,
          prompt_id: uuidFor(2, 'prompt'),
          due_at: future,
          reps: 1,
          lapses: 0,
          last_rating: 4
        }
      ],
      learning_item_tags: [
        { item_id: uuidFor(1, 'item'), learning_tags: { name: 'arbeitsrecht' } },
        { item_id: uuidFor(2, 'item'), learning_tags: { name: 'arbeitsrecht' } }
      ]
    }

    vi.doMock('../../src/renderer/src/cloudAuth', () => ({
      getSupabaseAuthClient: () => createSupabaseClientMock()
    }))
    const apiModulePath = '../../src/renderer/src/cloudLearningApi'
    const { createCloudLearningApi } = (await import(/* @vite-ignore */ apiModulePath)) as {
      createCloudLearningApi: (localApi: AppApi) => AppApi
    }
    const api = createCloudLearningApi(createLocalApiStub())
    const cards = await api.getReviewBatch({ collectionId, tag: 'arbeitsrecht', limit: 5 })

    expect(cards.map((card) => card.id)).toEqual([uuidFor(1, 'prompt'), uuidFor(2, 'prompt')])
    expect(cards[1]).toEqual(expect.objectContaining({ lastRating: 4, reps: 1 }))
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

  it('loads cloud statistics and the public podcast catalog and upserts private progress', async () => {
    const seriesId = 'ba7b2026-0400-4000-8000-000000000001'
    const episodeId = 'ba7b2026-0400-4000-8000-000000000101'
    tableData = {
      podcast_legal_areas: [
        { id: '33333333-3333-4333-8333-333333333333', slug: 'oeffentliches-recht', name: 'Öffentliches Recht' }
      ],
      podcast_series: [
        {
          id: seriesId,
          legal_area_id: '33333333-3333-4333-8333-333333333333',
          slug: 'baybo-april-2026',
          title: 'BayBO',
          description: 'Bauordnungsrecht',
          edition: 'April 2026',
          artwork_url: null
        }
      ],
      podcast_episodes: [
        {
          id: episodeId,
          series_id: seriesId,
          slug: 'grundbegriffe',
          episode_number: 1,
          title: 'Grundbegriffe',
          description: 'Die Grundlagen.',
          duration_seconds: 700,
          audio_url: 'https://app.jura-wolpi.de/audio/folge-1.mp3',
          published_at: now
        }
      ],
      podcast_episode_progress: []
    }

    vi.doMock('../../src/renderer/src/cloudAuth', () => ({
      getSupabaseAuthClient: () => createSupabaseClientMock()
    }))
    const apiModulePath = '../../src/renderer/src/cloudLearningApi'
    const { createCloudLearningApi } = (await import(/* @vite-ignore */ apiModulePath)) as {
      createCloudLearningApi: (localApi: AppApi) => AppApi
    }
    const api = createCloudLearningApi(createLocalApiStub())

    await expect(api.getLearningStatistics()).resolves.toMatchObject({
      totalCards: 301,
      reviewCountTotal: 12,
      ratingCounts: [
        { rating: 1, count: 1 },
        { rating: 2, count: 2 },
        { rating: 3, count: 3 },
        { rating: 4, count: 4 }
      ]
    })
    await expect(api.getPodcastCatalog()).resolves.toMatchObject({
      legalAreas: [
        {
          slug: 'oeffentliches-recht',
          series: [
            {
              id: seriesId,
              episodes: [{ id: episodeId, progress: null }]
            }
          ]
        }
      ]
    })
    await expect(
      api.savePodcastProgress({
        episodeId,
        positionSeconds: 200,
        durationSeconds: 700,
        completed: false
      })
    ).resolves.toEqual(expect.objectContaining({ episodeId, positionSeconds: 200 }))
    expect(rpcCalls).toContainEqual(
      expect.objectContaining({
        name: 'upsert_podcast_progress',
        args: expect.objectContaining({ p_episode_id: episodeId })
      })
    )
  })

  it('loads and upserts the signed-in user profile', async () => {
    tableData = {
      user_profiles: [{
        user_id: userId,
        first_name: 'Sebastian',
        last_name: 'Erhardt',
        created_at: '2026-07-15T06:11:01.038141+00:00',
        updated_at: '2026-07-15T06:11:00.926+00:00'
      }]
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

    await expect(api.getUserProfile()).resolves.toMatchObject({
      userId,
      firstName: 'Sebastian',
      lastName: 'Erhardt'
    })
    await expect(api.updateUserProfile({ firstName: 'Sebi', lastName: 'E.' })).resolves.toMatchObject({
      userId,
      firstName: 'Sebi',
      lastName: 'E.'
    })

    expect(queryCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'user_profiles', operation: 'select' }),
      expect.objectContaining({ table: 'user_profiles', operation: 'eq', column: 'user_id', value: userId }),
      expect.objectContaining({ table: 'user_profiles', operation: 'upsert' })
    ]))
    expect(upsertCalls).toContainEqual(expect.objectContaining({
      table: 'user_profiles',
      value: expect.objectContaining({
        user_id: userId,
        first_name: 'Sebi',
        last_name: 'E.'
      })
    }))
  })

  it('loads cloud card pages with ranged item queries and page-local details', async () => {
    const total = 30
    const items = Array.from({ length: total }, (_, index) => ({
      id: uuidFor(index, 'item'),
      primary_collection_id: collectionId,
      owner_user_id: userId,
      title: `Karte ${String(index + 1).padStart(2, '0')}`,
      external_id: `card-${index + 1}`,
      is_archived: false,
      created_at: now,
      updated_at: now
    }))
    tableData = {
      learning_items: items,
      learning_prompts: items.map((item, index) => ({
        id: uuidFor(index, 'prompt'),
        item_id: item.id,
        front_markdown: `Vorderseite ${index + 1}`,
        back_markdown: `Rueckseite ${index + 1}`,
        is_archived: false,
        created_at: now,
        updated_at: now
      })),
      learning_prompt_schedules: items.map((_item, index) => ({
        prompt_id: uuidFor(index, 'prompt'),
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
    const page = await api.listLearningCardsPage({ collectionId, page: 2, pageSize: 10 })

    expect(page).toMatchObject({ total, page: 2, pageSize: 10, pageCount: 3 })
    expect(page.items).toHaveLength(10)
    expect(page.items[0].title).toBe('Karte 11')
    expect(queryCalls).toContainEqual({
      table: 'learning_items',
      operation: 'range',
      from: 10,
      to: 19
    })
    const promptIdCalls = queryCalls.filter((call) => call.table === 'learning_prompts' && call.operation === 'in')
    expect(promptIdCalls).toHaveLength(1)
    expect(promptIdCalls[0].value).toHaveLength(10)
  })

  it('adds cloud-only exams to an existing browser without replacing its local work', async () => {
    const localId = '44444444-4444-4444-8444-444444444444'
    const importedId = '55555555-5555-4555-8555-555555555555'
    const local = createBrowserStoreWithExam(localId, 'Neuere lokale Ausarbeitung')
    const remote = createBrowserStoreWithExam(importedId, 'Importierte Ausarbeitung')
    remote.revisions[0].id = '66666666-6666-4666-8666-666666666666'
    remote.exams[0].currentRevisionId = remote.revisions[0].id
    remote.exams.push(...createBrowserStoreWithExam(localId, 'Alter Cloud-Stand').exams)
    remote.revisions.push(...createBrowserStoreWithExam(localId, 'Alter Cloud-Stand').revisions)
    writeBrowserStore(local)
    localStorage.setItem('jura-wolpertinger-cloud-browser-snapshot-v1', JSON.stringify({ userId, updatedAt: now }))
    tableData.user_sync_snapshots = [{ user_id: userId, local_user_id: userId, payload_json: { browserStore: remote }, updated_at: now }]
    vi.doMock('../../src/renderer/src/cloudAuth', () => ({ getSupabaseAuthClient: () => createSupabaseClientMock() }))
    const modulePath = '../../src/renderer/src/cloudLearningApi'
    const { createCloudLearningApi } = await import(/* @vite-ignore */ modulePath)
    const api = createCloudLearningApi(createBrowserExamLocalApiStub())
    expect(JSON.stringify((await api.getExam(importedId)).currentRevision?.content)).toContain('Importierte Ausarbeitung')
    expect(JSON.stringify((await api.getExam(localId)).currentRevision?.content)).toContain('Neuere lokale Ausarbeitung')
    expect(readBrowserStore().exams).toHaveLength(2)
    expect(queryCalls.filter(c => c.table === 'user_sync_snapshots' && c.operation === 'select')).toHaveLength(1)
  })

  it.each(['load', 'upload'] as const)('adopts a tag import once during %s while preserving local work and later tag removals', async action => {
    const examId = '44444444-4444-4444-8444-444444444444'
    const local = createBrowserStoreWithExam(examId, 'Neuere lokale Ausarbeitung')
    local.exams[0].tags = ['Eigener Tag']
    local.exams[0].notes = 'Eigene Notiz'
    local.exams[0].updatedAt = '2026-09-20T18:00:00.000Z'
    const remote = createBrowserStoreWithExam(examId, 'Alter Cloud-Text')
    const tagImport = { schemaVersion: 1, revision: 1, tags: ['Arbeitsrecht', 'Kündigungsschutzklage'] }
    Object.assign(remote.exams[0], { tags: tagImport.tags, tagImport })
    writeBrowserStore(local)
    vi.doMock('../../src/renderer/src/cloudAuth', () => ({ getSupabaseAuthClient: () => createSupabaseClientMock() }))
    const modulePath = '../../src/renderer/src/cloudLearningApi'
    const { createCloudLearningApi } = await import(/* @vite-ignore */ modulePath)
    const api = createCloudLearningApi(createBrowserExamLocalApiStub())
    if (action === 'upload') await api.getExam(examId)
    tableData.user_sync_snapshots = [{ user_id: userId, local_user_id: userId, payload_json: { browserStore: remote }, updated_at: now }]
    if (action === 'load') {
      await api.getExam(examId)
      expect(readBrowserStore().revisions).toEqual(local.revisions)
      expect(readBrowserStore().exams[0]).toEqual({ ...local.exams[0], tags: ['Arbeitsrecht', 'Eigener Tag', 'Kündigungsschutzklage'], tagImport })
    } else {
      await api.saveRevision({ examId, kind: 'manual', content: tiptapDoc('Weitergeschrieben') })
      await waitForCondition(() => upsertCalls.length === 1)
      expect(JSON.stringify(upsertCalls[0].value.payload_json)).toContain('Weitergeschrieben')
      expect(readBrowserStore().exams[0]).toMatchObject({ tags: ['Arbeitsrecht', 'Eigener Tag', 'Kündigungsschutzklage'], notes: 'Eigene Notiz', tagImport })
    }
    // Simulate a subsequent explicit user removal. A stale remote import must not restore it.
    const edited = readBrowserStore()
    edited.exams[0].tags = ['Eigener Tag']
    writeBrowserStore(edited)
    const uploadsBefore = upsertCalls.length
    await api.saveRevision({ examId, kind: 'manual', content: tiptapDoc('Weitere eigene Bearbeitung') })
    await waitForCondition(() => upsertCalls.length > uploadsBefore)
    expect(readBrowserStore().exams[0].tags).toEqual(['Eigener Tag'])
    const payload = upsertCalls.at(-1)?.value.payload_json as { browserStore: { exams: unknown[] }; tables: { exams: Array<{ tags_json: string }> } }
    expect(payload.browserStore.exams[0]).toMatchObject({ tags: ['Eigener Tag'], tagImport })
    expect(JSON.parse(payload.tables.exams[0].tags_json)).toEqual(['Eigener Tag'])
  })

  it.each(['unknown schema', 'invalid revision', 'invalid tags', 'foreign owner', 'stale revision'] as const)('ignores an unsafe tag import: %s', async kind => {
    const examId = '44444444-4444-4444-8444-444444444444'
    const local = createBrowserStoreWithExam(examId, 'Eigener Text')
    const remote = createBrowserStoreWithExam(examId, 'Cloud-Text')
    const tagImport = { schemaVersion: 1, revision: 1, tags: ['Importiert'] }
    Object.assign(remote.exams[0], { tags: ['Importiert'], tagImport })
    if (kind === 'unknown schema') tagImport.schemaVersion = 2
    if (kind === 'invalid revision') tagImport.revision = -1
    if (kind === 'invalid tags') Object.assign(tagImport, { tags: [null] })
    if (kind === 'foreign owner') remote.exams[0].userId = '77777777-7777-4777-8777-777777777777'
    if (kind === 'stale revision') Object.assign(local.exams[0], { tagImport: { ...tagImport, revision: 2 } })
    writeBrowserStore(local)
    tableData.user_sync_snapshots = [{ user_id: userId, local_user_id: userId, payload_json: { browserStore: remote }, updated_at: now }]
    vi.doMock('../../src/renderer/src/cloudAuth', () => ({ getSupabaseAuthClient: () => createSupabaseClientMock() }))
    const modulePath = '../../src/renderer/src/cloudLearningApi'
    const { createCloudLearningApi } = await import(/* @vite-ignore */ modulePath)
    await createCloudLearningApi(createBrowserExamLocalApiStub()).getExam(examId)
    expect(readBrowserStore().exams).toEqual(local.exams)
    expect(readBrowserStore().revisions).toEqual(local.revisions)
  })

  it.each(['load', 'upload'] as const)('adopts a date import once during %s and persists the date and receipt through upload and fresh hydration', async action => {
    const { local, remote, marker, examId } = dateImportFixture()
    writeBrowserStore(local)
    const api = await browserCloudApi()
    if (action === 'upload') await api.getExam(examId)
    setRemoteSnapshot(remote)
    if (action === 'load') {
      await api.getExam(examId)
      expect(readBrowserStore().exams[0]).toEqual({ ...local.exams[0], createdAt: marker.createdAt, dateImport: marker })
      expect(readBrowserStore().revisions).toEqual(local.revisions)
    }
    await api.saveRevision({ examId, content: tiptapDoc('Mein weitergeschriebener Entwurf') })
    await waitForCondition(() => upsertCalls.length === 1)
    const uploaded = upsertCalls[0].value.payload_json as { browserStore: ReturnType<typeof createBrowserStoreWithExam>; tables: { exams: Array<{ created_at: string }> } }
    expect(uploaded.browserStore.exams[0]).toMatchObject({ createdAt: marker.createdAt, dateImport: marker, title: 'Mein Titel', notes: 'Meine Notiz', tags: ['Eigener Tag'], status: 'archived' })
    expect(uploaded.tables.exams[0].created_at).toBe(marker.createdAt)
    expect(JSON.stringify(uploaded.browserStore.revisions)).toContain('Mein weitergeschriebener Entwurf')
    // An already acknowledged import must not undo a later deliberate date edit.
    const edited = readBrowserStore()
    const manualDate = '2025-06-04T08:00:00.000Z'
    edited.exams[0].createdAt = manualDate
    writeBrowserStore(edited)
    setRemoteSnapshot(remote)
    await api.saveRevision({ examId, content: tiptapDoc('Spätere Bearbeitung') })
    await waitForCondition(() => upsertCalls.length === 2)
    expect(readBrowserStore().exams[0]).toMatchObject({ createdAt: manualDate, dateImport: marker })
    // Reload the uploaded snapshot into a fresh browser and save again.
    tableData.user_sync_snapshots = [{ ...upsertCalls[1].value, updated_at: now }]
    localStorage.removeItem(browserStoreKey)
    expect((await api.getExam(examId)).createdAt).toBe(manualDate)
    expect(readBrowserStore().exams[0]).toMatchObject({ dateImport: marker })
    await api.saveRevision({ examId, content: tiptapDoc('Frische Sitzung') })
    await waitForCondition(() => upsertCalls.length === 3)
    const latest = upsertCalls[2].value.payload_json as typeof uploaded
    expect(latest.tables.exams[0].created_at).toBe(manualDate)
  })

  it.each(['schema', 'local date conflict', 'mismatched target', 'foreign owner', 'foreign snapshot', 'unknown local marker', 'duplicate exam'] as const)('retains the remote date import and locally saved draft when upload rejects %s', async kind => {
    const { local, remote, marker, examId } = dateImportFixture()
    if (kind === 'schema') marker.schemaVersion = 99
    if (kind === 'local date conflict') local.exams[0].createdAt = '2025-06-04T08:00:00.000Z'
    if (kind === 'mismatched target') remote.exams[0].createdAt = now
    if (kind === 'foreign owner') remote.exams[0].userId = collectionId
    if (kind === 'foreign snapshot') remote.currentUserId = collectionId
    if (kind === 'unknown local marker') Object.assign(local.exams[0], { dateImport: { schemaVersion: 99 } })
    if (kind === 'duplicate exam') remote.exams.push(structuredClone(remote.exams[0]))
    writeBrowserStore(local)
    const api = await browserCloudApi()
    await api.getExam(examId)
    setRemoteSnapshot(remote)
    const remoteBefore = structuredClone(tableData.user_sync_snapshots)
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    await api.saveRevision({ examId, content: tiptapDoc('Sicher auf diesem Gerät gespeichert') })
    await waitForCondition(() => upsertCalls.length > 0 || logged.mock.calls.length > 0)
    expect(upsertCalls).toHaveLength(0)
    expect(tableData.user_sync_snapshots).toEqual(remoteBefore)
    expect(readBrowserStore().exams[0].createdAt).toBe(local.exams[0].createdAt)
    expect(JSON.stringify(readBrowserStore().revisions)).toContain('Sicher auf diesem Gerät gespeichert')
  })

  it('applies date, tag and correction imports together without replacing the local draft', async () => {
    const { local, remote, examId } = correctionImportFixture()
    const dateImport = { schemaVersion: 1, revision: 1, userId, examId, previousCreatedAt: now, createdAt: '2025-06-03T08:00:00.000Z' }
    const tagImport = { schemaVersion: 1, revision: 1, tags: ['Importierter Tag'] }
    Object.assign(remote.exams[0], { dateImport, createdAt: dateImport.createdAt, tagImport, tags: tagImport.tags })
    writeBrowserStore(local)
    setRemoteSnapshot(remote)
    await (await browserCloudApi()).getExam(examId)
    expect(readBrowserStore().exams[0]).toMatchObject({ createdAt: dateImport.createdAt, dateImport, tagImport, tags: ['Eigener Tag', 'Importierter Tag'] })
    expect(readBrowserStore().submissions).toEqual(remote.submissions)
    expect(readBrowserStore().corrections).toEqual(remote.corrections)
    expect(readBrowserStore().revisions).toContainEqual(local.revisions[0])
  })

  it('preserves an exam imported after this browser session started when uploading a local edit', async () => {
    const localId = '44444444-4444-4444-8444-444444444444'
    const importedId = '55555555-5555-4555-8555-555555555555'
    writeBrowserStore(createBrowserStoreWithExam(localId, 'Lokaler Text'))
    vi.doMock('../../src/renderer/src/cloudAuth', () => ({ getSupabaseAuthClient: () => createSupabaseClientMock() }))
    const modulePath = '../../src/renderer/src/cloudLearningApi'
    const { createCloudLearningApi } = await import(/* @vite-ignore */ modulePath)
    const api = createCloudLearningApi(createBrowserExamLocalApiStub())
    await api.getExam(localId)
    const remote = createBrowserStoreWithExam(importedId, 'Später importierte Klausur')
    remote.revisions[0].id = '66666666-6666-4666-8666-666666666666'
    remote.exams[0].currentRevisionId = remote.revisions[0].id
    tableData.user_sync_snapshots = [{ user_id: userId, local_user_id: userId, payload_json: { browserStore: remote }, updated_at: now }]
    await api.saveRevision({ examId: localId, kind: 'manual', content: tiptapDoc('Weitergeschriebener Text') })
    await waitForCondition(() => upsertCalls.length > 0)
    const uploaded = JSON.stringify(upsertCalls.at(-1)?.value.payload_json)
    expect(uploaded).toContain('Später importierte Klausur')
    expect(uploaded).toContain('Weitergeschriebener Text')
    expect(readBrowserStore().exams).toHaveLength(2)
  })

  it.each(['load', 'upload'] as const)('hydrates an explicit correction import once during %s without replacing local work', async action => {
    const { local, remote, marker, examId } = correctionImportFixture()
    writeBrowserStore(local)
    const api = await browserCloudApi()
    if (action === 'upload') await api.getExam(examId)
    setRemoteSnapshot(remote)
    if (action === 'load') await api.getExam(examId)
    else {
      await api.saveRevision({ examId, content: tiptapDoc('Neuer eigener Entwurf') })
      await waitForCondition(() => upsertCalls.length === 1)
    }
    let stored = readBrowserStore()
    expect(stored.submissions).toEqual(remote.submissions)
    expect(stored.corrections).toEqual(remote.corrections)
    expect(stored.inlineComments).toEqual(remote.inlineComments)
    expect(stored.attachments).toEqual(remote.attachments)
    expect(stored.revisions).toContainEqual(local.revisions[0])
    expect(stored.exams[0]).toMatchObject({ notes: 'Meine Notiz', tags: ['Eigener Tag'], correctionImport: marker })
    expect(stored.exams[0].status).toBe(action === 'load' ? 'corrected' : 'in_progress')
    // The acknowledged marker must never restore removed comments or overwrite manual grading.
    stored.corrections[0].score.points = 12
    stored.corrections[0].gradingComment = 'Eigene Ergänzung'
    stored.corrections[0].inlineComments = []
    stored.inlineComments = []
    stored.exams[0].status = 'archived'
    writeBrowserStore(stored)
    setRemoteSnapshot(remote)
    const before = upsertCalls.length
    await api.saveRevision({ examId, content: tiptapDoc('Spätere Bearbeitung') })
    await waitForCondition(() => upsertCalls.length > before)
    stored = readBrowserStore()
    expect(stored.corrections[0]).toMatchObject({ score: { points: 12 }, gradingComment: 'Eigene Ergänzung', inlineComments: [] })
    expect(stored.inlineComments).toEqual([])
    expect(stored.exams[0].status).toBe('archived')
    expect(stored.submissions).toHaveLength(1)
  })

  it.each(['schema', 'foreign submission', 'missing revision', 'wrong hash', 'foreign attachment', 'wrong comment hash', 'immutable collision', 'unknown local marker'] as const)('rejects the whole unsafe correction import: %s', async kind => {
    const { local, remote, marker, examId } = correctionImportFixture()
    if (kind === 'schema') marker.schemaVersion = 2
    if (kind === 'foreign submission') remote.submissions[0].userId = collectionId
    if (kind === 'missing revision') remote.revisions.pop()
    if (kind === 'wrong hash') remote.submissions[0].contentHash = 'wrong'
    if (kind === 'foreign attachment') remote.attachments[0].examId = collectionId
    if (kind === 'wrong comment hash') remote.corrections[0].inlineComments[0].anchor.contentHash = 'wrong'
    if (kind === 'immutable collision') local.revisions.push({ ...remote.revisions[1], content: tiptapDoc('Other immutable content') })
    if (kind === 'unknown local marker') Object.assign(local.exams[0], { correctionImport: { schemaVersion: 99 } })
    writeBrowserStore(local)
    setRemoteSnapshot(remote)
    await (await browserCloudApi()).getExam(examId)
    expect(readBrowserStore().exams).toEqual(local.exams)
    expect(readBrowserStore().submissions).toEqual([])
    expect(readBrowserStore().attachments).toEqual([])
    expect(readBrowserStore().revisions).toEqual(local.revisions)
  })

  it.each(['archived', 'in_progress'] as const)('preserves a locally changed %s status while importing historical children', async status => {
    const { local, remote, examId } = correctionImportFixture()
    local.exams[0].status = status
    if (status === 'in_progress') local.exams[0].currentRevisionId = uuidFor(80, 'event')
    writeBrowserStore(local)
    setRemoteSnapshot(remote)
    await (await browserCloudApi()).getExam(examId)
    expect(readBrowserStore().exams[0].status).toBe(status)
    expect(readBrowserStore().submissions).toHaveLength(1)
  })

  it('keeps pre-existing correction edits and imports only explicitly named trees', async () => {
    const { local, remote, examId } = correctionImportFixture()
    local.corrections.push({ ...remote.corrections[0], gradingComment: 'Meine Korrektur', inlineComments: [] })
    remote.submissions.push({ ...remote.submissions[0], id: uuidFor(99, 'event') })
    remote.attachments.push({ ...remote.attachments[0], id: uuidFor(98, 'event') })
    writeBrowserStore(local)
    setRemoteSnapshot(remote)
    await (await browserCloudApi()).getExam(examId)
    expect(readBrowserStore().corrections).toEqual(local.corrections)
    expect(readBrowserStore().inlineComments).toEqual([])
    expect(readBrowserStore().submissions).toHaveLength(1)
    expect(readBrowserStore().attachments).toHaveLength(1)
  })

  it('preserves valid private file manifests and rebuilds imported attachment entries on upload', async () => {
    const { local, remote, examId } = correctionImportFixture()
    const attachment = remote.attachments[0]
    writeBrowserStore(local)
    const api = await browserCloudApi()
    await api.getExam(examId)
    const preserved = { attachmentId: uuidFor(72, 'event'), relativePath: 'old/file.pdf', storagePath: `users/${userId}/workspaces/${userId}/attachments/${uuidFor(72, 'event')}/file.pdf`, size: 30 }
    setRemoteSnapshot(remote, [preserved, { ...preserved, storagePath: '../other-user/private.pdf' }])
    await api.saveRevision({ examId, content: tiptapDoc('Bearbeitet') })
    await waitForCondition(() => upsertCalls.length === 1)
    expect(upsertCalls[0].value.file_manifest_json).toEqual([preserved, {
      attachmentId: attachment.id, relativePath: attachment.relativePath, size: attachment.size,
      storagePath: `users/${userId}/workspaces/${userId}/attachments/${attachment.id}/${attachment.storedName}`
    }])
    const payload = upsertCalls[0].value.payload_json as { tables: Record<string, unknown[]> }
    expect(payload.tables.inline_comments).toHaveLength(1)
  })

  it('downloads a private imported attachment with its original name and releases the object URL', async () => {
    const { local, remote } = correctionImportFixture()
    writeBrowserStore(local)
    setRemoteSnapshot(remote)
    const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() }
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:private-file')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.stubGlobal('document', { createElement: vi.fn(() => link), body: { appendChild: vi.fn() } })
    await (await browserCloudApi()).openAttachment(remote.attachments[0].id)
    expect(downloadCalls).toEqual([{ bucket: 'user-files', path: `users/${userId}/workspaces/${userId}/attachments/${remote.attachments[0].id}/correction.pdf` }])
    expect(create).toHaveBeenCalledWith(downloadResult.data)
    expect(link.download).toBe('Korrektur.pdf')
    expect(link.href).toBe('blob:private-file')
    expect(link.click).toHaveBeenCalledOnce()
    expect(link.remove).toHaveBeenCalledOnce()
    await waitForCondition(() => revoke.mock.calls.length === 1)
    expect(revoke).toHaveBeenCalledWith('blob:private-file')
  })

  it('exports the current editable comments instead of stale flattened import comments', async () => {
    const { local, remote, examId } = correctionImportFixture()
    writeBrowserStore(local)
    setRemoteSnapshot(remote)
    const api = await browserCloudApi()
    await api.getExam(examId)
    const edited = readBrowserStore()
    edited.corrections[0].inlineComments[0].body = 'Meine ergänzte Randbemerkung'
    writeBrowserStore(edited)
    await api.saveRevision({ examId, content: tiptapDoc('Weitergeschrieben') })
    await waitForCondition(() => upsertCalls.length === 1)
    const payload = upsertCalls[0].value.payload_json as { tables: { inline_comments: Array<{ body: string }> } }
    expect(payload.tables.inline_comments[0].body).toBe('Meine ergänzte Randbemerkung')
  })

  it('rejects duplicate comment IDs across imported corrections atomically', async () => {
    const { local, remote, examId } = correctionImportFixture()
    const correctionId = uuidFor(84, 'event')
    remote.corrections.push({ ...remote.corrections[0], id: correctionId, inlineComments: [{ ...remote.inlineComments[0], correctionId }] })
    writeBrowserStore(local)
    setRemoteSnapshot(remote)
    await (await browserCloudApi()).getExam(examId)
    expect(readBrowserStore().submissions).toHaveLength(0)
    expect(readBrowserStore().corrections).toHaveLength(0)
  })

  it.each([
    ['load', 'edited'], ['load', 'deleted'], ['upload', 'edited'], ['upload', 'deleted']
  ] as const)('uses authoritative %s nested comments after they were %s in another browser', async (action, edit) => {
    const { local, remote, examId } = correctionImportFixture()
    // Browser edits change the nested array; the flattened import copy stays stale.
    remote.corrections[0].inlineComments = edit === 'edited'
      ? [{ ...remote.corrections[0].inlineComments[0], body: 'Nachträglich bearbeitet' }]
      : []
    writeBrowserStore(local)
    const api = await browserCloudApi()
    if (action === 'upload') await api.getExam(examId)
    setRemoteSnapshot(remote)
    if (action === 'load') await api.getExam(examId)
    else {
      await api.saveRevision({ examId, content: tiptapDoc('Mein neuer Entwurf') })
      await waitForCondition(() => upsertCalls.length === 1)
    }
    expect(readBrowserStore().submissions).toEqual(remote.submissions)
    expect(readBrowserStore().corrections[0].inlineComments).toEqual(remote.corrections[0].inlineComments)
    expect(readBrowserStore().inlineComments).toEqual(remote.corrections[0].inlineComments)
  })

  it.each(['immutable conflict', 'unknown schema', 'missing revision', 'foreign submission', 'unknown local marker'] as const)('retains remote historical data and local work when upload rejects an import: %s', async kind => {
    const { local, remote, marker, examId } = correctionImportFixture()
    if (kind === 'immutable conflict') local.revisions.push({ ...remote.revisions[1], content: tiptapDoc('Anderer unveränderlicher Text') })
    if (kind === 'unknown schema') marker.schemaVersion = 99
    if (kind === 'missing revision') remote.revisions.pop()
    if (kind === 'foreign submission') remote.submissions[0].userId = collectionId
    if (kind === 'unknown local marker') Object.assign(local.exams[0], { correctionImport: { schemaVersion: 99 } })
    writeBrowserStore(local)
    const api = await browserCloudApi()
    await api.getExam(examId)
    setRemoteSnapshot(remote)
    const remoteBefore = structuredClone(tableData.user_sync_snapshots)
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    await api.saveRevision({ examId, content: tiptapDoc('Mein lokal gesicherter Entwurf') })
    await waitForCondition(() => upsertCalls.length > 0 || logged.mock.calls.length > 0)
    expect(upsertCalls).toHaveLength(0)
    expect(tableData.user_sync_snapshots).toEqual(remoteBefore)
    expect(JSON.stringify(readBrowserStore().revisions)).toContain('Mein lokal gesicherter Entwurf')
    expect(logged).toHaveBeenCalled()
  })

  it.each(['foreign owner', 'foreign exam', 'unsafe name', 'unsafe id', 'storage error', 'account switch'] as const)('rejects attachment download safely: %s', async kind => {
    const { local, remote, examId } = correctionImportFixture()
    const file = remote.attachments[0]
    local.attachments.push(file)
    if (kind === 'foreign owner') file.userId = collectionId
    if (kind === 'foreign exam') local.exams[0].userId = collectionId
    if (kind === 'unsafe name') file.storedName = '../private.pdf'
    if (kind === 'unsafe id') file.id = '../other-account'
    if (kind === 'storage error') downloadResult = { data: null, error: new Error('Datei fehlt') }
    writeBrowserStore(local)
    const api = await browserCloudApi()
    await api.getExam(examId)
    if (kind === 'account switch') beforeDownloadResponse = () => { sessionUserId = collectionId }
    const create = vi.spyOn(URL, 'createObjectURL')
    await expect(api.openAttachment(file.id)).rejects.toThrow()
    expect(create).not.toHaveBeenCalled()
    expect(downloadCalls).toHaveLength(['storage error', 'account switch'].includes(kind) ? 1 : 0)
  })

  it.each(['load', 'upload'] as const)('leaves the new account untouched when the account changes during a snapshot %s', async action => {
    const examId = '44444444-4444-4444-8444-444444444444'
    const otherUserId = '77777777-7777-4777-8777-777777777777'
    const other = JSON.parse(JSON.stringify(createBrowserStoreWithExam(examId, 'Privater Text des anderen Kontos')).replaceAll(userId, otherUserId))
    writeBrowserStore(createBrowserStoreWithExam(examId, 'Text des ersten Kontos'))
    vi.doMock('../../src/renderer/src/cloudAuth', () => ({ getSupabaseAuthClient: () => createSupabaseClientMock() }))
    const modulePath = '../../src/renderer/src/cloudLearningApi'
    const { createCloudLearningApi } = await import(/* @vite-ignore */ modulePath)
    const api = createCloudLearningApi(createBrowserExamLocalApiStub())
    if (action === 'upload') await api.getExam(examId)
    let switched = false
    beforeSnapshotResponse = () => {
      sessionUserId = otherUserId
      writeBrowserStore(other)
      switched = true
      beforeSnapshotResponse = null
    }
    if (action === 'load') {
      await expect(api.getExam(examId)).rejects.toThrow('Konto wurde gewechselt')
    } else {
      await api.saveRevision({ examId, kind: 'manual', content: tiptapDoc('Weitere Bearbeitung') })
      await waitForCondition(() => switched)
      await new Promise<void>(resolve => setImmediate(resolve))
    }
    expect(readBrowserStore()).toEqual(other)
    expect(upsertCalls).toHaveLength(0)
  })

  it('stores browser exam revisions in the cloud snapshot and hydrates them in a fresh browser', async () => {
    const examId = '44444444-4444-4444-8444-444444444444'
    const uploadedText = 'Obersatz aus der Cloud-Klausur'
    writeBrowserStore(createBrowserStoreWithExam(examId, 'Lokaler Starttext'))

    vi.doMock('../../src/renderer/src/cloudAuth', () => ({
      getSupabaseAuthClient: () => createSupabaseClientMock()
    }))
    const apiModulePath = '../../src/renderer/src/cloudLearningApi'
    const { createCloudLearningApi } = (await import(/* @vite-ignore */ apiModulePath)) as {
      createCloudLearningApi: (localApi: AppApi) => AppApi
    }
    const api = createCloudLearningApi(createBrowserExamLocalApiStub())

    await api.saveRevision({
      examId,
      kind: 'autosave',
      content: tiptapDoc(uploadedText)
    })
    await waitForCondition(() => upsertCalls.length > 0)

    const uploadedSnapshot = upsertCalls.at(-1)?.value.payload_json
    expect(JSON.stringify(uploadedSnapshot)).toContain(uploadedText)
    expect(JSON.stringify(uploadedSnapshot)).toContain('"exam_revisions"')

    localStorage.removeItem(browserStoreKey)
    tableData.user_sync_snapshots = upsertCalls.map((call) => ({
      ...call.value,
      updated_at: now
    }))

    const hydrated = await api.getExam(examId)
    expect(JSON.stringify(hydrated.currentRevision?.content)).toContain(uploadedText)
  })
})

function createSupabaseClientMock() {
  return {
    storage: {
      from(bucket: string) {
        return { async download(path: string) {
          downloadCalls.push({ bucket, path })
          beforeDownloadResponse?.()
          return downloadResult
        } }
      }
    },
    auth: {
      async getSession() {
        return {
          data: {
            session: {
              user: {
                id: sessionUserId,
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
      if (name === 'study_flashcards' || name === 'get_study_collection_catalog') return studyRpcResult
      if (name === 'get_learning_status_counts') return statusCountsRpcResult
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
      if (name === 'get_learning_statistics') {
        return {
          data: {
            total_cards: 301,
            reviewed_cards: 10,
            review_count_total: 12,
            reviews_today: 2,
            reviews_last_7_days: 8,
            streak_days: 3,
            active_days_last_14: 6,
            activity: [{ date: '2026-07-05', reviews: 2 }],
            rating_counts: [
              { rating: 1, count: 1 },
              { rating: 2, count: 2 },
              { rating: 3, count: 3 },
              { rating: 4, count: 4 }
            ],
            collections: []
          },
          error: null
        }
      }
      if (name === 'get_podcast_catalog') {
        return {
          data: {
            legalAreas: [
              {
                slug: 'oeffentliches-recht',
                name: 'Öffentliches Recht',
                series: tableData.podcast_series.map((series) => ({
                  id: (series as Record<string, unknown>).id,
                  slug: (series as Record<string, unknown>).slug,
                  title: (series as Record<string, unknown>).title,
                  description: (series as Record<string, unknown>).description,
                  edition: (series as Record<string, unknown>).edition,
                  artworkUrl: null,
                  episodes: tableData.podcast_episodes.map((episode) => ({
                    id: (episode as Record<string, unknown>).id,
                    seriesId: (episode as Record<string, unknown>).series_id,
                    slug: (episode as Record<string, unknown>).slug,
                    number: (episode as Record<string, unknown>).episode_number,
                    title: (episode as Record<string, unknown>).title,
                    description: (episode as Record<string, unknown>).description,
                    durationSeconds: (episode as Record<string, unknown>).duration_seconds,
                    audioUrl: (episode as Record<string, unknown>).audio_url,
                    publishedAt: (episode as Record<string, unknown>).published_at,
                    progress: null
                  }))
                }))
              }
            ]
          },
          error: null
        }
      }
      if (name === 'upsert_podcast_progress') {
        return {
          data: {
            episodeId: args.p_episode_id,
            positionSeconds: args.p_position_seconds,
            durationSeconds: args.p_duration_seconds,
            completed: args.p_completed,
            lastPlayedAt: args.p_last_played_at,
            updatedAt: args.p_updated_at
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
    select(_columns: string, _options?: { count?: string }) {
      queryCalls.push({ table, operation: 'select' })
      return builder
    },
    eq(column: string, value: unknown) {
      queryCalls.push({ table, operation: 'eq', column, value })
      rows = rows.filter((row) => (row as Record<string, unknown>)[column] === value)
      return builder
    },
    is(column: string, value: unknown) {
      queryCalls.push({ table, operation: 'is', column, value })
      rows = rows.filter((row) => ((row as Record<string, unknown>)[column] ?? null) === value)
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
    range(from: number, to: number) {
      queryCalls.push({ table, operation: 'range', from, to })
      rows = rows.slice(from, to + 1)
      return builder
    },
    limit(value: number) {
      queryCalls.push({ table, operation: 'limit', value })
      rows = rows.slice(0, value)
      return builder
    },
    async maybeSingle<T>() {
      queryCalls.push({ table, operation: 'maybeSingle' })
      if (table === 'user_sync_snapshots') beforeSnapshotResponse?.()
      return { data: (rows[0] ?? null) as T | null, error: null }
    },
    async upsert(value: Record<string, unknown>, options?: Record<string, unknown>) {
      queryCalls.push({ table, operation: 'upsert', value })
      upsertCalls.push({ table, value, options })
      tableData[table] = [
        value,
        ...(tableData[table] ?? []).filter((row) => {
          const current = row as Record<string, unknown>
          return current.user_id !== value.user_id || current.local_user_id !== value.local_user_id
        })
      ]
      return { data: null, error: null }
    },
    async returns<T>() {
      return { data: rows as T, error: null, count: tableData[table]?.length ?? rows.length }
    }
  }
  return builder
}

function createLocalApiStub(): AppApi {
  return {
    getAppVersion: async () => '0.0.0',
    getFeatureFlags: unimplemented,
    createVoiceReviewSession: unimplemented,
    completeVoiceReviewSession: unimplemented,
    getUserProfile: unimplemented,
    updateUserProfile: unimplemented,
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
    listExamsPage: unimplemented,
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
    getLearningStatistics: unimplemented,
    exportLearningDecksJson: unimplemented,
    importLearningDecksJson: unimplemented,
    listLearningCollections: unimplemented,
    createLearningCollection: unimplemented,
    listLearningCards: unimplemented,
    listLearningCardsPage: unimplemented,
    createLearningCard: unimplemented,
    updateLearningCard: unimplemented,
    deleteLearningCard: unimplemented,
    getReviewBatch: unimplemented,
    recordReview: unimplemented,
    studyFlashcards: unimplemented,
    rateLearningCardQuality: unimplemented,
    getPodcastCatalog: unimplemented,
    savePodcastProgress: unimplemented,
    addAttachment: unimplemented,
    openAttachment: unimplemented,
    exportExamPackage: unimplemented,
    importExamPackage: unimplemented,
    exportExamPdf: unimplemented,
    createCorrection: unimplemented,
    updateCorrection: unimplemented,
    addInlineComment: unimplemented,
    getSyncStatus: unimplemented,
    connectSyncAccount: unimplemented,
    disconnectSyncAccount: unimplemented,
    runSync: unimplemented
  }
}

function createBrowserExamLocalApiStub(): AppApi {
  return {
    ...createLocalApiStub(),
    async listExams() {
      return readBrowserStore().exams
    },
    async listExamsPage() {
      const items = readBrowserStore().exams
      return {
        items,
        total: items.length,
        page: 1,
        pageSize: 25,
        pageCount: 1
      }
    },
    async getExam(id: string) {
      const store = readBrowserStore()
      const exam = store.exams.find((candidate) => candidate.id === id)
      if (!exam) throw new Error(`Exam not found: ${id}`)
      const currentRevision = store.revisions.find(
        (candidate) => candidate.id === exam.currentRevisionId
      ) ?? null
      return {
        ...exam,
        currentRevision,
        submissions: [],
        attachments: []
      } satisfies ExamDetails
    },
    async saveRevision(input) {
      const store = readBrowserStore()
      const exam = store.exams.find((candidate) => candidate.id === input.examId)
      if (!exam) throw new Error(`Exam not found: ${input.examId}`)
      const revision: ExamRevision = {
        schemaVersion: 1,
        editorSchemaVersion: 1,
        id: '55555555-5555-4555-8555-555555555555',
        userId: exam.userId,
        examId: input.examId,
        createdAt: now,
        kind: input.kind ?? 'autosave',
        contentFormat: 'tiptap-v1',
        contentHash: 'hash-after-save',
        content: input.content
      }
      store.revisions.push(revision)
      exam.currentRevisionId = revision.id
      exam.lastSavedAt = now
      exam.updatedAt = now
      writeBrowserStore(store)
      return revision
    }
  }
}

function createBrowserStoreWithExam(examId: string, text: string) {
  const revisionId = '33333333-3333-4333-8333-333333333333'
  const exam: ExamListItem = {
    id: examId,
    userId,
    title: 'Cloud Klausur',
    folderId: null,
    folderName: null,
    status: 'in_progress',
    tags: ['arbeitsrecht'],
    notes: '',
    createdAt: now,
    updatedAt: now,
    lastSavedAt: now,
    currentRevisionId: revisionId,
    latestScore: null,
    legalArea: null,
    examType: null,
    sourceName: null,
    sourceUrl: null
  }
  const revision: ExamRevision = {
    schemaVersion: 1,
    editorSchemaVersion: 1,
    id: revisionId,
    userId,
    examId,
    createdAt: now,
    kind: 'autosave',
    contentFormat: 'tiptap-v1',
    contentHash: 'hash-before-save',
    content: tiptapDoc(text)
  }
  return {
    users: [{
      id: userId,
      displayName: 'learner@example.test',
      kind: 'remote',
      remoteUserId: userId,
      onboardingCompletedAt: now,
      tourCompletedAt: now,
      createdAt: now,
      updatedAt: now
    }],
    currentUserId: userId,
    folders: [],
    exams: [exam],
    revisions: [revision],
    submissions: [] as Submission[],
    attachments: [] as Attachment[],
    corrections: [] as Correction[],
    inlineComments: [] as InlineComment[],
    aiSettings: null,
    aiCorrectionDrafts: [],
    learningTasks: [],
    learningCollections: [],
    learningCards: [],
    learningReviewEvents: [],
    learningSchedules: []
  }
}

async function browserCloudApi(): Promise<AppApi> {
  vi.doMock('../../src/renderer/src/cloudAuth', () => ({ getSupabaseAuthClient: () => createSupabaseClientMock() }))
  const path = '../../src/renderer/src/cloudLearningApi'
  return (await import(/* @vite-ignore */ path)).createCloudLearningApi(createBrowserExamLocalApiStub())
}

function setRemoteSnapshot(store: ReturnType<typeof createBrowserStoreWithExam>, files: unknown[] = []): void {
  tableData.user_sync_snapshots = [{ user_id: userId, local_user_id: userId, payload_json: { browserStore: store }, file_manifest_json: files, updated_at: now }]
}

function dateImportFixture() {
  const examId = '44444444-4444-4444-8444-444444444444'
  const local = createBrowserStoreWithExam(examId, 'Mein lokaler Entwurf')
  Object.assign(local.exams[0], { title: 'Mein Titel', notes: 'Meine Notiz', tags: ['Eigener Tag'], status: 'archived' })
  const remote = createBrowserStoreWithExam(examId, 'Alter Cloud-Entwurf')
  const marker = { schemaVersion: 1, revision: 1, userId, examId, previousCreatedAt: now, createdAt: '2025-06-03T08:00:00.000Z' }
  Object.assign(remote.exams[0], { createdAt: marker.createdAt, dateImport: marker })
  return { local, remote, marker, examId }
}

function correctionImportFixture() {
  const examId = '44444444-4444-4444-8444-444444444444'
  const local = createBrowserStoreWithExam(examId, 'Mein Entwurf')
  local.exams[0].notes = 'Meine Notiz'
  local.exams[0].tags = ['Eigener Tag']
  const remote = createBrowserStoreWithExam(examId, 'Alter Cloud Entwurf')
  const revision: ExamRevision = { ...remote.revisions[0], id: uuidFor(61, 'event'), kind: 'submission', content: tiptapDoc('Historische Abgabe'), contentHash: 'historical-content-hash' }
  const submission: Submission = { schemaVersion: 1, id: uuidFor(62, 'event'), userId, examId, submittedAt: now, revisionId: revision.id, contentHash: revision.contentHash, canContinueEditing: true, pdfPath: null }
  const comment: InlineComment = { schemaVersion: 1, id: uuidFor(64, 'event'), userId, targetSubmissionId: submission.id, correctionId: uuidFor(63, 'event'), createdAt: now, status: 'open', body: 'Begründung fehlt', tags: [], anchor: { type: 'prosemirror-selection', editorSchemaVersion: 1, from: 0, to: 11, selectedText: 'Historische', prefix: '', suffix: ' Abgabe', contentHash: revision.contentHash } }
  const correction: Correction = { schemaVersion: 1, id: comment.correctionId, userId, targetSubmissionId: submission.id, createdAt: now, updatedAt: now, score: { system: 'bayern-0-18', points: 8 }, gradingComment: 'Gute Ansätze', tags: [], inlineComments: [comment] }
  const attachment: Attachment = { schemaVersion: 1, id: uuidFor(65, 'event'), userId, examId, originalName: 'Korrektur.pdf', storedName: 'correction.pdf', mimeType: 'application/pdf', size: 3, relativePath: `attachments/${uuidFor(65, 'event')}/correction.pdf`, role: 'other', createdAt: now }
  const marker = { schemaVersion: 1, revision: 1, submissionIds: [submission.id], attachmentIds: [attachment.id], previousStatus: local.exams[0].status, currentRevisionId: local.exams[0].currentRevisionId }
  Object.assign(remote.exams[0], { correctionImport: marker, status: 'corrected' })
  remote.revisions.push(revision)
  remote.submissions.push(submission)
  remote.corrections.push(correction)
  remote.inlineComments.push(comment)
  remote.attachments.push(attachment)
  return { local, remote, marker, examId }
}

function tiptapDoc(text: string): Record<string, unknown> {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }]
      }
    ]
  }
}

function readBrowserStore(): ReturnType<typeof createBrowserStoreWithExam> {
  const raw = localStorage.getItem(browserStoreKey)
  if (!raw) throw new Error('Browser store is empty')
  return JSON.parse(raw)
}

function writeBrowserStore(store: ReturnType<typeof createBrowserStoreWithExam>): void {
  localStorage.setItem(browserStoreKey, JSON.stringify(store))
}

function createMemoryLocalStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key: string) {
      return values.get(key) ?? null
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null
    },
    removeItem(key: string) {
      values.delete(key)
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    }
  }
}

async function waitForCondition(predicate: () => boolean): Promise<void> {
  for (let index = 0; index < 25; index += 1) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('Timed out waiting for condition')
}

function unimplemented(): never {
  throw new Error('Unexpected local fallback call')
}

function uuidFor(index: number, kind: 'item' | 'prompt' | 'event'): string {
  const prefix = kind === 'item' ? '10000000' : kind === 'prompt' ? '20000000' : '30000000'
  return `${prefix}-0000-4000-8000-${String(index).padStart(12, '0')}`
}
