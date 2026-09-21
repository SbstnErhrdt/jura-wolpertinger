import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { AppServices } from '@main/services/services'
import type { StoredStudyRun } from '@shared/flashcardStudyEngine'
import { buildCloudLearningStateFromLocal, type CloudLearningSyncState } from '@main/services/learningSyncService'
import { createWorkspaceSnapshot, type WorkspaceSnapshot } from '@main/services/syncService'

let directory: string, services: AppServices, remoteUserId: string
let remote: StoredStudyRun[], learningUploads: number, runUploads: Array<{ state: StoredStudyRun; expected: string | null }>
let rejectCas: boolean
let duringRunUpload: (() => void) | undefined
let remoteSnapshot: WorkspaceSnapshot | null
let cloudLearningState: CloudLearningSyncState
let progressUploads: CloudLearningSyncState[]
let duringLearningDownload: (() => void) | undefined
const emptyState: CloudLearningSyncState = { collections: [], cards: [], schedules: [], reviewEvents: [], qualityEvents: [] }
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'study-sync-'))
  services = new AppServices(directory)
  remoteUserId = randomUUID(); remote = []; learningUploads = 0; runUploads = []; rejectCas = false
  duringRunUpload = undefined; remoteSnapshot = null
  cloudLearningState = structuredClone(emptyState); progressUploads = []
  duringLearningDownload = undefined
  services.db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('sync_remote_user_id', remoteUserId)
  const client = {
    async downloadStudyRuns() { return structuredClone(remote) },
    async uploadStudyRun(state: StoredStudyRun, expected: string | null): Promise<StoredStudyRun> {
      runUploads.push({ state: structuredClone(state), expected })
      const old = remote.find(run => run.id === state.id)
      if (rejectCas || (old?.updatedAt ?? null) !== expected) throw new Error('Durchgang wurde auf einem anderen Gerät geändert.')
      const result = { ...structuredClone(state), userId: remoteUserId, actions: [], updatedAt: `2026-09-09T20:00:00.${String(runUploads.length).padStart(6, '0')}+00:00` }
      remote = remote.filter(run => run.id !== state.id).concat(result)
      duringRunUpload?.()
      return result
    },
    async downloadLearningState() { duringLearningDownload?.(); return structuredClone(cloudLearningState) },
    async uploadStudyProgress(_state: CloudLearningSyncState, runs: StoredStudyRun[]) {
      progressUploads.push(structuredClone(_state))
      const before = structuredClone(remote)
      try { return await Promise.all(runs.map((run) => client.uploadStudyRun(run, run.cloudUpdatedAt ?? null))) }
      catch (error) { remote = before; throw error }
    },
    async uploadLearningState() { learningUploads++ },
    async downloadLatestSnapshot() { return remoteSnapshot },
    async uploadSnapshot() {}, async uploadFile() {}
  }
  ;(services as unknown as { syncClient: typeof client }).syncClient = client
})
afterEach(async () => { services.close(); await rm(directory, { recursive: true, force: true }) })

function start(count = 3) {
  const collectionId = services.createLearningCollection({ name: 'Sammlung' }).id
  for (let i = 0; i < count; i++) services.createLearningCard({ collectionId, title: `Karte ${i}`, frontMarkdown: '?', backMarkdown: '!', tags: [] })
  return services.studyFlashcards({ action: 'start', collectionId, mode: 'all' })
}
function stored(runId: string): StoredStudyRun {
  return JSON.parse((services.db.prepare('SELECT run_json FROM learning_study_runs WHERE id = ?').get(runId) as { run_json: string }).run_json)
}

it('uploads ordered deferred membership, keeps local undo actions and round-trips exact microsecond revisions', async () => {
  const first = start(), runId = first.run!.id, eventId = randomUUID()
  services.studyFlashcards({ action: 'rate', runId, cardId: first.cards[0].id, rating: 2, eventId })
  services.studyFlashcards({ action: 'defer', runId, cardId: first.cards[1].id })
  await services.runSync({ action: 'upload' })
  expect(remote).toHaveLength(1)
  expect(remote[0].items).toEqual(stored(runId).items)
  expect(stored(runId).actions).toHaveLength(1)
  expect(stored(runId).cloudUpdatedAt).toBe('2026-09-09T20:00:00.000001+00:00')
  services.studyFlashcards({ action: 'resume_deferred', runId })
  await services.runSync({ action: 'upload' })
  expect(runUploads[1].expected).toBe('2026-09-09T20:00:00.000001+00:00')
  services.studyFlashcards({ action: 'undo', runId, eventId })
  expect(services.getLearningStatistics().reviewCountTotal).toBe(0)
})

it('pulls cloud membership only when local state is clean and keeps local user ownership', async () => {
  const first = start(), runId = first.run!.id
  await services.runSync({ action: 'upload' })
  remote[0].items[0].deferred = true
  remote[0].updatedAt = '2026-09-09T20:00:01.123456+00:00'
  await services.runSync({ action: 'merge' })
  expect(stored(runId).userId).toBe(services.getCurrentUser().id)
  expect(services.studyFlashcards({ action: 'batch', runId }).run?.deferred).toBe(1)
  expect(runUploads).toHaveLength(1)
  expect(stored(runId).cloudUpdatedAt).toBe(remote[0].updatedAt)
})

it('refuses both-dirty conflicts before review/schedule upload and preserves local progress', async () => {
  const first = start(), runId = first.run!.id
  await services.runSync({ action: 'upload' })
  services.studyFlashcards({ action: 'defer', runId, cardId: first.cards[0].id })
  const before = stored(runId)
  remote[0].items[1].deferred = true
  remote[0].updatedAt = '2026-09-09T20:00:01.999999+00:00'
  await expect(services.runSync({ action: 'merge' })).rejects.toThrow(/anderen Gerät|unterschiedlich/)
  expect(learningUploads).toBe(1)
  expect(stored(runId)).toEqual(before)
})

it('an explicit download replaces dirty members while retaining local undo actions', async () => {
  const first = start(), runId = first.run!.id
  services.studyFlashcards({ action: 'rate', runId, cardId: first.cards[0].id, rating: 3, eventId: randomUUID() })
  await services.runSync({ action: 'upload' })
  services.studyFlashcards({ action: 'defer', runId, cardId: first.cards[1].id })
  remote[0].items[2].deferred = true
  remote[0].updatedAt = '2026-09-09T20:00:02.333333+00:00'
  await services.runSync({ action: 'download' })
  expect(stored(runId).items).toEqual(remote[0].items)
  expect(stored(runId).actions).toHaveLength(1)
})

it('leaves a locally changed run dirty when the authoritative server CAS rejects a race', async () => {
  const first = start(), runId = first.run!.id
  await services.runSync({ action: 'upload' })
  services.studyFlashcards({ action: 'defer', runId, cardId: first.cards[0].id })
  const before = stored(runId)
  rejectCas = true
  await expect(services.runSync({ action: 'upload' })).rejects.toThrow(/anderen Gerät/)
  expect(stored(runId)).toEqual(before)
})

it('keeps progress made while uploading dirty for the next sync', async () => {
  const first = start(), runId = first.run!.id
  duringRunUpload = () => services.studyFlashcards({ action: 'defer', runId, cardId: first.cards[0].id })
  await services.runSync({ action: 'upload' })
  expect(stored(runId).items[0].deferred).toBe(true)
  expect(remote[0].items[0].deferred).toBe(false)
  expect(stored(runId).cloudSyncedLocalUpdatedAt).toBeUndefined()
  duringRunUpload = undefined
  await services.runSync({ action: 'upload' })
  expect(remote[0].items[0].deferred).toBe(true)
})

it('uses run CAS with a multi-card snapshot whose schedules have composite keys', async () => {
  const first = start(), runId = first.run!.id
  await services.runSync({ action: 'upload' })
  remoteSnapshot = createWorkspaceSnapshot({ db: services.db, filesDir: directory, localUserId: services.getCurrentUser().id, remoteUserId })
  services.studyFlashcards({ action: 'defer', runId, cardId: first.cards[0].id })
  await services.runSync({ action: 'merge' })
  expect(remote[0].items[0].deferred).toBe(true)
})

it.each(['merge', 'upload', 'download'] as const)('adopts a web undo with an earlier exact schedule during %s', async action => {
  const first = start(1), cardId = first.cards[0].id
  const original = buildCloudLearningStateFromLocal({ db: services.db, localUserId: services.getCurrentUser().id, remoteUserId }).schedules[0]
  original.updatedAt = '2026-01-01T00:00:00.000Z'
  services.recordReview({ cardId, rating: 3 })
  await services.runSync({ action: 'upload' })
  cloudLearningState = buildCloudLearningStateFromLocal({ db: services.db, localUserId: services.getCurrentUser().id, remoteUserId })
  cloudLearningState.schedules = [original]
  cloudLearningState.reviewEvents[0].voidedAt = '2026-09-09T23:00:00.000Z'
  await services.runSync({ action })
  expect(services.db.prepare('SELECT reps, updated_at FROM learning_card_schedules WHERE card_id = ?').get(cardId))
    .toEqual({ reps: 0, updated_at: original.updatedAt })
  expect(services.getLearningStatistics().reviewCountTotal).toBe(0)
  if (action !== 'download') expect(progressUploads.at(-1)?.schedules[0].reps).toBe(0)
})

it.each(['merge', 'download'] as const)('removes the local schedule when a web undo restores absence during %s', async action => {
  const first = start(1), cardId = first.cards[0].id
  services.recordReview({ cardId, rating: 3 })
  await services.runSync({ action: 'upload' })
  cloudLearningState = buildCloudLearningStateFromLocal({ db: services.db, localUserId: services.getCurrentUser().id, remoteUserId })
  cloudLearningState.schedules = []
  cloudLearningState.reviewEvents[0].voidedAt = '2026-09-09T23:00:00.000Z'
  await services.runSync({ action })
  expect(services.db.prepare('SELECT * FROM learning_card_schedules WHERE card_id = ?').get(cardId)).toBeUndefined()
  expect(services.getLearningStatistics().reviewCountTotal).toBe(0)
  if (action !== 'download') expect(progressUploads.at(-1)?.schedules).toEqual([])
})

it.each([true, false])('protects pending local undo against cloud schedule replacement/deletion (present: %s)', async cloudSchedulePresent => {
  const first = start(1), cardId = first.cards[0].id, runId = first.run!.id, eventId = randomUUID()
  const original = services.db.prepare('SELECT * FROM learning_card_schedules WHERE card_id = ?').get(cardId)
  services.studyFlashcards({ action: 'rate', runId, cardId, eventId, rating: 3 })
  await services.runSync({ action: 'upload' })
  cloudLearningState = buildCloudLearningStateFromLocal({ db: services.db, localUserId: services.getCurrentUser().id, remoteUserId })
  if (!cloudSchedulePresent) cloudLearningState.schedules = []
  services.studyFlashcards({ action: 'undo', runId, eventId })
  await services.runSync({ action: 'merge' })
  expect(services.db.prepare('SELECT * FROM learning_card_schedules WHERE card_id = ?').get(cardId)).toEqual(original)
  expect(progressUploads.at(-1)?.schedules[0].reps).toBe(0)
  expect(progressUploads.at(-1)?.reviewEvents[0].voidedAt).toEqual(expect.any(String))
})

it('protects a local rating made while cloud progress is loading from the stale initial sync plan', async () => {
  const first = start(1), cardId = first.cards[0].id, runId = first.run!.id
  await services.runSync({ action: 'upload' })
  cloudLearningState = buildCloudLearningStateFromLocal({ db: services.db, localUserId: services.getCurrentUser().id, remoteUserId })
  duringLearningDownload = () => services.studyFlashcards({ action: 'rate', runId, cardId, rating: 3, eventId: randomUUID() })
  await services.runSync({ action: 'upload' })
  expect(services.db.prepare('SELECT reps FROM learning_card_schedules WHERE card_id = ?').get(cardId)).toEqual({ reps: 1 })
  expect(progressUploads.at(-1)?.schedules[0].reps).toBe(1)
})
