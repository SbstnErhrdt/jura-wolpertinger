import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { AppServices } from '@main/services/services'
import { buildCloudLearningStateFromLocal, mergeCloudLearningStateIntoLocal } from '@main/services/learningSyncService'
import { createWorkspaceSnapshot, restoreWorkspaceSnapshot } from '@main/services/syncService'

let directory: string
let services: AppServices
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'study-service-'))
  services = new AppServices(directory)
})
afterEach(async () => { services.close(); await rm(directory, { recursive: true, force: true }) })
function deck(count: number) {
  const collection = services.createLearningCollection({ name: 'Lernen' })
  for (let i = 0; i < count; i++) services.createLearningCard({ collectionId: collection.id, title: `Karte ${i}`, frontMarkdown: 'Frage?', backMarkdown: 'Antwort', tags: [] })
  return collection.id
}
function schedule(cardId: string) {
  return services.db.prepare('SELECT * FROM learning_card_schedules WHERE card_id = ?').get(cardId)
}

it('loads a read-only catalog with collection names, progress, search and owner isolation', () => {
  const collectionId = deck(3)
  const run = services.studyFlashcards({ action: 'start', collectionId, mode: 'first_pass' }).run!
  const before = services.db.prepare('SELECT * FROM learning_study_runs').all()
  expect(services.studyFlashcards({ action: 'catalog', search: '  LERNEN ' }).catalog).toMatchObject({
    total: 1, items: [{ id: collectionId, name: 'Lernen', overview: { eligibleCards: 3 } }],
    recommendation: { kind: 'resume', collection: { overview: { activeRun: { id: run.id } } } }
  })
  expect(services.db.prepare('SELECT * FROM learning_study_runs').all()).toEqual(before)
  services.createUser('Andere Person')
  expect(services.studyFlashcards({ action: 'catalog' }).catalog).toMatchObject({ items: [], recommendation: null, collectionCount: 0 })
})

it('finishes 100 distinct cards even when every rating is wrong, resuming after 40', () => {
  const collectionId = deck(100)
  let result = services.studyFlashcards({ action: 'start', collectionId, mode: 'first_pass' })
  const runId = result.run!.id
  const seen = new Set<string>()
  for (let i = 0; i < 100; i++) {
    expect(result.cards.length).toBeLessThanOrEqual(40)
    const cardId = result.cards[0].id
    expect(seen.has(cardId)).toBe(false)
    seen.add(cardId)
    result = services.studyFlashcards({ action: 'rate', runId, cardId, rating: 1, eventId: randomUUID() })
    if (i === 39) {
      services.close(); services = new AppServices(directory)
      result = services.studyFlashcards({ action: 'start', collectionId, mode: 'first_pass' })
      expect(result.run).toMatchObject({ id: runId, completed: 40, remaining: 60 })
    }
  }
  expect(result.run).toMatchObject({ completed: 100, remaining: 0, status: 'completed' })
  expect(result.cards).toEqual([])
})

it('persists deferred cards and frozen membership across restart and isolates users', () => {
  const collectionId = deck(2)
  const start = services.studyFlashcards({ action: 'start', collectionId, mode: 'first_pass' })
  const runId = start.run!.id
  const cardId = start.cards[0].id
  services.studyFlashcards({ action: 'defer', runId, cardId })
  services.close(); services = new AppServices(directory)
  services.createLearningCard({ collectionId, title: 'Neu', frontMarkdown: 'Neu?', backMarkdown: 'Neu', tags: [] })
  const batch = services.studyFlashcards({ action: 'batch', runId })
  expect(batch.run).toMatchObject({ total: 2, deferred: 1, added: 1 })
  expect(batch.cards.map(card => card.id)).not.toContain(cardId)
  expect(services.studyFlashcards({ action: 'resume_deferred', runId }).cards.map(card => card.id)).toContain(cardId)
  services.createUser('Andere Person')
  expect(services.studyFlashcards({ action: 'overview' }).overviews).toEqual([])
  expect(() => services.studyFlashcards({ action: 'batch', runId })).toThrow()
})

it('deduplicates ratings, exactly restores schedules and voids history and statistics', () => {
  const collectionId = deck(1)
  const start = services.studyFlashcards({ action: 'start', collectionId, mode: 'first_pass' })
  const runId = start.run!.id, cardId = start.cards[0].id, eventId = randomUUID()
  const previous = schedule(cardId)
  const command = { action: 'rate' as const, runId, cardId, rating: 3 as const, eventId }
  const rated = services.studyFlashcards(command)
  expect(services.studyFlashcards(command).review).toEqual(rated.review)
  expect(services.getLearningStatistics().reviewCountTotal).toBe(1)
  services.close(); services = new AppServices(directory)
  const undone = services.studyFlashcards({ action: 'undo', runId, eventId })
  expect(undone.run).toMatchObject({ completed: 0, remaining: 1 })
  expect(schedule(cardId)).toEqual(previous)
  expect(services.getLearningStatistics()).toMatchObject({ reviewCountTotal: 0, reviewedCards: 0, reviewsToday: 0 })
  expect(services.getLearningDashboard().learnedToday).toBe(false)
  expect(services.db.prepare('SELECT voided_at FROM learning_review_events WHERE id = ?').get(eventId)).toEqual({ voided_at: expect.any(String) })
  expect(() => services.studyFlashcards(command)).toThrow()
})

it('refuses undo after a later review even when timestamps tie', () => {
  const start = services.studyFlashcards({ action: 'start', collectionId: deck(1), mode: 'first_pass' })
  const runId = start.run!.id, cardId = start.cards[0].id, eventId = randomUUID()
  const rated = services.studyFlashcards({ action: 'rate', runId, cardId, eventId, rating: 1 })
  const later = services.recordReview({ cardId, rating: 3 })
  services.db.prepare('UPDATE learning_review_events SET reviewed_at = ? WHERE id = ?').run(rated.review!.event.reviewedAt, later.event.id)
  const previous = schedule(cardId)
  expect(() => services.studyFlashcards({ action: 'undo', runId, eventId })).toThrow()
  expect(schedule(cardId)).toEqual(previous)
  expect(services.getLearningStatistics().reviewCountTotal).toBe(2)
})

it('exports and merges tombstones without resurrecting a voided review', () => {
  const start = services.studyFlashcards({ action: 'start', collectionId: deck(1), mode: 'first_pass' })
  const runId = start.run!.id, cardId = start.cards[0].id, eventId = randomUUID()
  services.studyFlashcards({ action: 'rate', runId, cardId, eventId, rating: 2 })
  const localUserId = services.getCurrentUser().id
  const stale = buildCloudLearningStateFromLocal({ db: services.db, localUserId, remoteUserId: randomUUID() })
  services.studyFlashcards({ action: 'undo', runId, eventId })
  const state = buildCloudLearningStateFromLocal({ db: services.db, localUserId, remoteUserId: randomUUID() })
  expect(state.reviewEvents[0].voidedAt).toEqual(expect.any(String))
  mergeCloudLearningStateIntoLocal({ db: services.db, localUserId, cloudState: stale })
  expect(services.getLearningStatistics().reviewCountTotal).toBe(0)
  expect(services.studyFlashcards({ action: 'batch', runId }).run?.completed).toBe(0)
})

it('restores a deferred run from a workspace snapshot with remapped user ownership', () => {
  const start = services.studyFlashcards({ action: 'start', collectionId: deck(2), mode: 'first_pass' })
  const runId = start.run!.id, cardId = start.cards[0].id
  services.studyFlashcards({ action: 'defer', runId, cardId })
  const snapshot = createWorkspaceSnapshot({ db: services.db, filesDir: directory, localUserId: services.getCurrentUser().id, remoteUserId: randomUUID() })
  expect(snapshot.tables.learning_study_runs).toHaveLength(1)
  const targetUserId = randomUUID()
  // Simulate a fresh device; old rows would otherwise share global card IDs.
  services.db.prepare('DELETE FROM users').run()
  restoreWorkspaceSnapshot({ db: services.db, snapshot, targetUserId })
  expect(services.studyFlashcards({ action: 'batch', runId }).run).toMatchObject({ deferred: 1, remaining: 2 })
})

it('rolls a review back if saving traversal fails', () => {
  const start = services.studyFlashcards({ action: 'start', collectionId: deck(1), mode: 'first_pass' })
  const runId = start.run!.id, cardId = start.cards[0].id
  const previous = schedule(cardId)
  services.db.exec("CREATE TRIGGER fail_study_save BEFORE UPDATE ON learning_study_runs BEGIN SELECT RAISE(ABORT, 'save failed'); END")
  expect(() => services.studyFlashcards({ action: 'rate', runId, cardId, rating: 3, eventId: randomUUID() })).toThrow('save failed')
  expect(schedule(cardId)).toEqual(previous)
  expect(services.getLearningStatistics().reviewCountTotal).toBe(0)
})

it('migrates a version 6 database and preserves reviews', () => {
  const collectionId = deck(1)
  const cardId = services.listLearningCards(collectionId)[0].id
  services.recordReview({ cardId, rating: 4 })
  services.db.exec('DROP TABLE learning_study_runs; ALTER TABLE learning_review_events DROP COLUMN voided_at;')
  services.db.prepare("UPDATE meta SET value = '6' WHERE key = 'schema_version'").run()
  services.close(); services = new AppServices(directory)
  expect(services.studyFlashcards({ action: 'start', collectionId, mode: 'first_pass' }).run).toMatchObject({ completed: 1 })
  expect(services.getLearningStatistics().reviewCountTotal).toBe(1)
})
