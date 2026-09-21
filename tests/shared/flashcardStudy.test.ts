import { describe, expect, it } from 'vitest'
import { executeStudyCommand, type StudyContext, type StoredStudyRun } from '../../src/shared/flashcardStudyEngine'
import type { ReviewCard } from '../../src/shared/schemas'

function fixture(count = 100) {
  let sequence = 0
  const cards: ReviewCard[] = Array.from({ length: count }, (_, i) => ({
    schemaVersion: 1, id: `card-${i}`, userId: 'learner', collectionId: 'collection',
    externalId: null, title: `Karte ${i}`, frontMarkdown: 'Frage', backMarkdown: 'Antwort',
    tags: [], isArchived: false, dueAt: '2026-01-01T00:00:00Z', lastRating: null,
    reps: 0, lapses: 0, qualityStatus: null, qualityReasons: [], qualityNote: '', qualityRatedAt: null,
    createdAt: `2026-01-01T00:00:${String(i % 60).padStart(2, '0')}Z`, updatedAt: '2026-01-01T00:00:00Z'
  }))
  const events: Array<{ id: string; cardId: string }> = []
  const context: StudyContext = {
    userId: 'learner', runs: [], now: () => '2026-09-09T10:00:00Z', newId: () => `run-${++sequence}`,
    collectionIds: () => ['collection'], cards: () => cards,
    capture: (id) => structuredClone(cards.find((card) => card.id === id)),
    record: (input) => {
      const card = cards.find((card) => card.id === input.cardId)!
      card.reps += 1; card.lastRating = input.rating
      events.push({ id: input.clientEventId!, cardId: card.id })
      return { event: { schemaVersion: 1, id: input.clientEventId!, userId: 'learner', cardId: card.id, rating: input.rating, reviewedAt: context.now(), elapsedMs: null }, nextDueAt: context.now(), intervalLabel: 'später' }
    },
    undo: (review, previous) => {
      if (events.filter((event) => event.cardId === review.event.cardId).at(-1)?.id !== review.event.id) throw new Error('Neuere Bewertung vorhanden')
      Object.assign(cards.find((card) => card.id === review.event.cardId)!, previous)
      events.splice(events.findIndex((event) => event.id === review.event.id), 1)
    }
  }
  const command = (input: Parameters<typeof executeStudyCommand>[0]) => executeStudyCommand(input, context)
  const start = () => command({ action: 'start', collectionId: 'collection', mode: 'first_pass' }).run!
  return { context, cards, events, command, start }
}

describe('persistent flashcard traversal', () => {
  it('reaches all 100 different cards even when every answer is not known', () => {
    const f = fixture(); const run = f.start(); const ids: string[] = []
    for (let i = 0; i < 100; i++) {
      const batch = f.command({ action: 'batch', runId: run.id })
      expect(batch.cards.length).toBeLessThanOrEqual(40)
      const cardId = batch.cards[0].id; ids.push(cardId)
      f.command({ action: 'rate', runId: run.id, cardId, rating: 1, eventId: `event-${i}` })
    }
    expect(new Set(ids).size).toBe(100)
    expect(f.command({ action: 'batch', runId: run.id }).run).toMatchObject({ completed: 100, remaining: 0, status: 'completed' })
  })

  it('resumes stored membership, remembers skipped cards, and separates newly added cards', () => {
    const f = fixture(3); const run = f.start()
    const cardId = f.command({ action: 'batch', runId: run.id }).cards[0].id
    f.command({ action: 'defer', runId: run.id, cardId })
    f.context.runs = JSON.parse(JSON.stringify(f.context.runs)) as StoredStudyRun[]
    f.cards.push({ ...f.cards[1], id: 'added' })
    expect(f.start().id).toBe(run.id)
    const next = f.command({ action: 'batch', runId: run.id })
    expect(next.cards.map((card) => card.id)).not.toContain(cardId)
    expect(next.cards.map((card) => card.id)).not.toContain('added')
    expect(next.run).toMatchObject({ total: 3, deferred: 1, added: 1, remaining: 3 })
    f.command({ action: 'resume_deferred', runId: run.id })
    expect(f.command({ action: 'batch', runId: run.id }).cards[0].id).toBe(cardId)
  })

  it('deduplicates ratings, restores progress on undo, and rejects reused IDs', () => {
    const f = fixture(2); const run = f.start(); const cardId = f.cards[0].id
    const rate = { action: 'rate' as const, runId: run.id, cardId, rating: 1 as const, eventId: 'same-event' }
    f.command(rate); f.command(rate)
    expect(f.events).toHaveLength(1)
    expect(f.command({ action: 'batch', runId: run.id }).run?.completed).toBe(1)
    expect(() => f.command({ ...rate, cardId: f.cards[1].id })).toThrow()
    f.command({ action: 'undo', runId: run.id, eventId: rate.eventId })
    expect(f.command({ action: 'batch', runId: run.id }).run?.completed).toBe(0)
    expect(f.cards[0].reps).toBe(0)
  })

  it('counts previous reviews and other-mode reviews without forcing repeated first-pass cards', () => {
    const f = fixture(3); f.cards[0].reps = 1; f.cards[0].lastRating = 2
    const run = f.start(); expect(run.completed).toBe(1)
    f.cards[1].reps = 1
    expect(f.command({ action: 'batch', runId: run.id }).run?.completed).toBe(2)
    expect(f.command({ action: 'batch', runId: run.id }).cards).toHaveLength(1)
  })

  it('excludes cards paused after selection and enforces owner/collection boundaries', () => {
    const f = fixture(2); const run = f.start(); f.cards[0].qualityStatus = 'problematic'
    expect(f.command({ action: 'batch', runId: run.id }).run).toMatchObject({ total: 1, excluded: 1 })
    expect(() => f.command({ action: 'rate', runId: run.id, cardId: f.cards[0].id, rating: 1, eventId: 'bad' })).toThrow()
    f.context.userId = 'other'
    expect(() => f.command({ action: 'batch', runId: run.id })).toThrow()
  })

  it('keeps completion stable when excluded cards return, but allows explicit undo', () => {
    const f = fixture(2); const run = f.start()
    f.cards[1].qualityStatus = 'problematic'
    const rated = f.command({ action: 'rate', runId: run.id, cardId: f.cards[0].id, rating: 1, eventId: 'last' })
    expect(rated.run).toMatchObject({ status: 'completed', total: 1, excluded: 1 })
    f.cards[1].qualityStatus = 'good'
    f.context.runs = JSON.parse(JSON.stringify(f.context.runs)) as StoredStudyRun[]
    const closed = f.command({ action: 'batch', runId: run.id })
    expect(closed.run).toMatchObject({ status: 'completed', total: 1, excluded: 1, added: 1 })
    expect(closed.cards).toHaveLength(0)
    expect(f.start().id).not.toBe(run.id)
    expect(f.command({ action: 'undo', runId: run.id, eventId: 'last' }).run?.status).toBe('active')
  })

  it('does not offer a previously answered excluded card as new after completion', () => {
    const f = fixture(2); f.cards[0].reps = 1
    const run = f.start(); f.cards[0].qualityStatus = 'problematic'
    f.command({ action: 'rate', runId: run.id, cardId: f.cards[1].id, rating: 3, eventId: 'last' })
    f.cards[0].qualityStatus = 'good'
    expect(f.command({ action: 'batch', runId: run.id }).run).toMatchObject({ status: 'completed', added: 0 })
  })
})
