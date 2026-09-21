import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SupabaseSyncClient } from '@main/services/supabaseSyncClient'
import { randomUUID } from 'node:crypto'
import type { StoredStudyRun } from '@shared/flashcardStudyEngine'
import { AppServices } from '@main/services/services'
import { buildCloudLearningStateFromLocal } from '@main/services/learningSyncService'
import type { CloudLearningSyncState } from '@main/services/learningSyncService'

const originalCwd = process.cwd()
const originalEnv = {
  JURA_SYNC_SUPABASE_ANON_KEY: process.env.JURA_SYNC_SUPABASE_ANON_KEY,
  JURA_EMBEDDED_SYNC_SUPABASE_ANON_KEY: process.env.JURA_EMBEDDED_SYNC_SUPABASE_ANON_KEY,
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
  ANON_KEY: process.env.ANON_KEY
}

let tempDir: string | null = null

afterEach(async () => {
  process.chdir(originalCwd)
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true })
    tempDir = null
  }
})

describe('SupabaseSyncClient configuration', () => {
  it('reads the public sync key from a local env file for desktop development', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'jura-sync-config-'))
    process.chdir(tempDir)
    delete process.env.JURA_SYNC_SUPABASE_ANON_KEY
    delete process.env.VITE_SUPABASE_ANON_KEY
    delete process.env.ANON_KEY
    await writeFile(join(tempDir, '.env'), 'ANON_KEY=local-anon-key\n')

    expect(() => new SupabaseSyncClient()).not.toThrow()
  })

  it('uses the public sync key embedded in an installed desktop build', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'jura-sync-config-'))
    process.chdir(tempDir)
    delete process.env.JURA_SYNC_SUPABASE_ANON_KEY
    delete process.env.VITE_SUPABASE_ANON_KEY
    delete process.env.ANON_KEY
    process.env.JURA_EMBEDDED_SYNC_SUPABASE_ANON_KEY = 'embedded-anon-key'

    expect(() => new SupabaseSyncClient()).not.toThrow()
  })
})

function studyClient(rpc: (name: string, input: Record<string, unknown>) => Promise<unknown>, userId: string) {
  const client = new SupabaseSyncClient('https://example.test', 'test-anon-key')
  const transport = client as unknown as { client: { rpc: typeof rpc }; account: { remoteUserId: string; email: null } }
  transport.client = { rpc }
  transport.account = { remoteUserId: userId, email: null }
  return client
}

function cloudRun(userId: string): StoredStudyRun {
  return { id: randomUUID(), userId, collectionId: randomUUID(), mode: 'all',
    createdAt: '2026-09-09T10:00:00.000001+00:00', updatedAt: '2026-09-09T10:00:01.123456+00:00',
    items: [{ cardId: randomUUID(), completed: false, deferred: true }], actions: [] }
}

it('downloads traversal metadata in bounded pages and preserves timestamp precision', async () => {
  const userId = randomUUID(), runs = Array.from({ length: 26 }, () => cloudRun(userId))
  const calls: Array<Record<string, unknown>> = []
  const client = studyClient(async (name, input) => {
    expect(name).toBe('get_flashcard_study_runs')
    calls.push(input)
    return { data: runs.slice(Number(input.p_offset), Number(input.p_offset) + Number(input.p_limit)), error: null }
  }, userId)
  expect(await client.downloadStudyRuns()).toEqual(runs)
  expect(calls).toEqual([{ p_offset: 0, p_limit: 25 }, { p_offset: 25, p_limit: 25 }])
})

it('sends immutable membership metadata without local ownership/actions and exact CAS revision', async () => {
  const userId = randomUUID(), run = cloudRun(userId), revision = run.updatedAt
  const client = studyClient(async (name, input) => {
    expect(name).toBe('sync_flashcard_study_run')
    expect(input.p_expected_updated_at).toBe(revision)
    expect(input.p_state).toEqual({ id: run.id, collectionId: run.collectionId, mode: run.mode,
      createdAt: run.createdAt, updatedAt: run.updatedAt, items: run.items, completion: null })
    return { data: run, error: null }
  }, userId)
  expect(await client.uploadStudyRun({ ...run, userId: randomUUID() }, revision)).toEqual(run)
})

it('rejects foreign ownership and converts server CAS conflicts into a learner-facing error', async () => {
  const userId = randomUUID(), run = cloudRun(randomUUID())
  const foreign = studyClient(async () => ({ data: [run], error: null }), userId)
  await expect(foreign.downloadStudyRuns()).rejects.toThrow()
  const conflict = studyClient(async () => ({ data: null, error: { code: '40001', message: 'revision conflict' } }), userId)
  await expect(conflict.uploadStudyRun(run, run.updatedAt)).rejects.toThrow(/anderen Gerät/)
})

it('transfers reviews, schedules and completed runs in one atomic RPC with schedule and run revisions', async () => {
  const userId = randomUUID(), run = cloudRun(userId)
  run.completion = { total: 1, completed: 1, excluded: 0 }
  run.items[0] = { ...run.items[0], completed: true, deferred: false }
  run.cloudUpdatedAt = run.updatedAt
  const cardId = run.items[0].cardId
  const state: CloudLearningSyncState = { collections: [], cards: [], qualityEvents: [],
    schedules: [{ userId, cardId, dueAt: run.updatedAt, reps: 0, lapses: 0, lastRating: null, lastReviewedAt: null, updatedAt: run.updatedAt }],
    reviewEvents: [{ id: randomUUID(), userId, cardId, rating: 1, reviewedAt: run.createdAt, elapsedMs: null, voidedAt: run.updatedAt }] }
  const client = studyClient(async (name, input) => {
    expect(name).toBe('sync_flashcard_learning_progress')
    expect(input.p_schedules).toEqual(state.schedules)
    expect(input.p_review_events).toEqual(state.reviewEvents)
    expect(input.p_expected_schedules).toEqual([{ cardId, updatedAt: run.createdAt }])
    expect(input.p_runs).toMatchObject([{ expectedUpdatedAt: run.updatedAt, state: { completion: run.completion } }])
    return { data: [run], error: null }
  }, userId)
  const result = await client.uploadStudyProgress(state, [run], [{ ...state.schedules[0], updatedAt: run.createdAt }])
  expect(result[0].completion).toEqual(run.completion)
  const rejected = studyClient(async () => ({ data: null, error: { code: '40001' } }), userId)
  await expect(rejected.uploadStudyProgress(state, [run], [])).rejects.toThrow(/anderen Gerät/)
})

it('sends an explicit CAS-protected schedule deletion after syncing a review whose prior schedule was absent', async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'jura-null-schedule-sync-'))
  const services = new AppServices(tempDir)
  try {
    const collectionId = services.createLearningCollection({ name: 'Ohne Zeitplan' }).id
    const cardId = services.createLearningCard({ collectionId, title: 'Karte', frontMarkdown: '?', backMarkdown: '!', tags: [] }).id
    services.db.prepare('DELETE FROM learning_card_schedules WHERE card_id = ?').run(cardId)
    const runId = services.studyFlashcards({ action: 'start', collectionId, mode: 'all' }).run!.id
    const eventId = randomUUID(), userId = randomUUID()
    services.studyFlashcards({ action: 'rate', runId, cardId, rating: 3, eventId })
    const getRun = () => JSON.parse((services.db.prepare('SELECT run_json FROM learning_study_runs WHERE id = ?').get(runId) as { run_json: string }).run_json) as StoredStudyRun
    const getState = () => buildCloudLearningStateFromLocal({ db: services.db, localUserId: services.getCurrentUser().id, remoteUserId: userId })
    const ratedState = getState()
    let phase = 'rate'
    const client = studyClient(async (_name, input) => {
      if (phase === 'undo') {
        expect(input.p_schedules).toEqual([])
        expect(input.p_schedule_deletions).toEqual([{ cardId, eventId, runId }])
        expect(input.p_expected_schedules).toEqual([{ cardId, updatedAt: ratedState.schedules[0].updatedAt }])
      }
      return { data: [{ ...getRun(), userId, actions: [] }], error: null }
    }, userId)
    await client.uploadStudyProgress(ratedState, [getRun()], [])
    phase = 'undo'
    services.studyFlashcards({ action: 'undo', runId, eventId })
    expect(getRun().actions[0].previous).toBeNull()
    expect(getState().schedules).toEqual([])
    await client.uploadStudyProgress(getState(), [getRun()], ratedState.schedules)
  } finally { services.close() }
})
