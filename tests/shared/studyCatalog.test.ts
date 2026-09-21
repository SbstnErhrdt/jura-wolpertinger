import { describe, expect, it } from 'vitest'
import { executeStudyCommand, type StudyContext } from '../../src/shared/flashcardStudyEngine'
import type { ReviewCard } from '../../src/shared/schemas'
import * as catalogHelpers from '../../src/shared/studyCatalog'

function fixture() {
  let sequence = 0
  const collections: Array<{ id: string; name: string; subject: string | null }> = []
  const cards: ReviewCard[] = []
  const context: StudyContext = {
    userId: 'learner', runs: [], now: () => '2026-09-20T10:00:00Z', newId: () => `run-${++sequence}`,
    collectionIds: () => collections.map(c => c.id), collections: () => collections,
    cards: id => cards.filter(c => c.collectionId === id),
    capture: () => { throw new Error('Catalog must not capture') },
    record: () => { throw new Error('Catalog must not rate') },
    undo: () => { throw new Error('Catalog must not undo') }
  }
  function deck(id: string, count: number, reviewed = 0, name = id, subject: string | null = null) {
    collections.push({ id, name, subject })
    for (let i = 0; i < count; i++) cards.push({
      schemaVersion: 1, id: `${id}-${i}`, userId: 'learner', collectionId: id,
      externalId: null, title: 'Karte', frontMarkdown: 'Frage', backMarkdown: 'Antwort', tags: [], isArchived: false,
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      dueAt: '2026-01-01T00:00:00Z', reps: i < reviewed ? 1 : 0, lapses: 0, lastRating: null,
      qualityStatus: null, qualityReasons: [], qualityNote: '', qualityRatedAt: null
    })
  }
  const catalog = (search = '', page = 1) => executeStudyCommand({ action: 'catalog', search, page }, context).catalog!
  return { context, cards, deck, catalog }
}

describe('collection catalog', () => {
  it('shows progress as reviewed/eligible and never rounds incomplete work to 100%', () => {
    const f = fixture(); f.deck('a', 1000, 999)
    const overview = f.catalog().items[0].overview
    expect(catalogHelpers.studyProgress(overview)).toBe(99)
    expect(catalogHelpers.studyProgress({ ...overview, reviewedCards: 1000 })).toBe(100)
    expect(catalogHelpers.studyProgress({ ...overview, reviewedCards: 0 })).toBe(0)
    expect(catalogHelpers.studyProgress({ ...overview, eligibleCards: 0 })).toBeNull()
  })
  it('recommends due reviews ahead of active runs and new cards, with stable ties', () => {
    const f = fixture()
    f.deck('c', 4, 2); f.deck('b', 4, 2); f.deck('a', 1)
    executeStudyCommand({ action: 'start', collectionId: 'a', mode: 'first_pass' }, f.context)
    expect(f.catalog().recommendation).toMatchObject({ kind: 'review', collection: { id: 'b', overview: { dueCards: 2 } } })
  })

  it('chooses the latest active run, including a newer review run within one collection', () => {
    const f = fixture(); f.deck('a', 3, 1); f.deck('b', 2)
    const first = executeStudyCommand({ action: 'start', collectionId: 'a', mode: 'first_pass' }, f.context).run!
    const review = executeStudyCommand({ action: 'start', collectionId: 'a', mode: 'review' }, f.context).run!
    executeStudyCommand({ action: 'start', collectionId: 'b', mode: 'first_pass' }, f.context)
    f.context.runs.find(r => r.id === review.id)!.updatedAt = '2026-09-20T11:00:00Z'
    f.cards.forEach(c => { c.dueAt = '2027-01-01T00:00:00Z' })
    expect(f.catalog().recommendation).toMatchObject({ kind: 'resume', collection: { id: 'a', overview: { activeRun: { id: review.id } } } })
    expect(f.catalog().items.find(c => c.id === 'a')).toMatchObject({ defaultRun: { id: first.id, mode: 'first_pass' } })
    expect(executeStudyCommand({ action: 'overview' }, f.context).overviews[0].activeRun?.id).toBe(first.id)
  })

  it('recommends the smallest new-card count and never empty, paused or finished decks', () => {
    const f = fixture(); f.deck('empty', 0); f.deck('paused', 1); f.deck('large', 10); f.deck('small', 2)
    f.cards.find(c => c.collectionId === 'paused')!.qualityStatus = 'needs_work'
    expect(f.catalog().recommendation).toMatchObject({ kind: 'new', collection: { id: 'small' } })
    f.cards.forEach(c => { c.reps = 1; c.dueAt = '2027-01-01T00:00:00Z' })
    expect(f.catalog()).toMatchObject({ recommendation: null, collectionCount: 4, eligibleCollectionCount: 2 })
  })

  it('searches all pages, treats wildcards literally and retains a global recommendation', () => {
    const f = fixture()
    for (let i = 0; i < 26; i++) f.deck(`deck-${String(i).padStart(2, '0')}`, 1)
    f.deck('z', 2, 2, '100% Bau_Recht', 'Öffentliches Recht')
    expect(f.catalog().items).toHaveLength(24)
    expect(f.catalog('', 2).items).toHaveLength(3)
    expect(f.catalog('  ÖFFENTLICHES  ')).toMatchObject({ total: 1, items: [{ id: 'z' }] })
    expect(f.catalog('%').total).toBe(1)
    expect(f.catalog('_').total).toBe(1)
    expect(f.catalog('deck-01')).toMatchObject({ total: 1, recommendation: { kind: 'review', collection: { id: 'z' } } })
    expect(f.catalog('missing')).toMatchObject({ total: 0, items: [], collectionCount: 27, recommendation: { collection: { id: 'z' } } })
  })

  it('reports accurate eligible progress without modifying stored runs or leaking card text', () => {
    const f = fixture(); f.deck('a', 3, 1)
    executeStudyCommand({ action: 'start', collectionId: 'a', mode: 'first_pass' }, f.context)
    f.cards[1].reps = 1; f.cards[2].qualityStatus = 'problematic'
    const before = JSON.stringify(f.context.runs)
    const result = f.catalog()
    expect(result.items[0].overview).toMatchObject({ totalCards: 3, eligibleCards: 2, reviewedCards: 2, newCards: 0, pausedCards: 1, activeRun: null })
    expect(JSON.stringify(f.context.runs)).toBe(before)
    expect(JSON.stringify(result)).not.toContain('frontMarkdown')
  })

  it('reports status colors from eligible cards only', () => {
    const f = fixture(); f.deck('a', 6)
    f.cards[0].reps = 1; f.cards[0].lastRating = 1
    f.cards[1].reps = 1; f.cards[1].lastRating = 2
    f.cards[2].reps = 1; f.cards[2].lastRating = 3
    f.cards[3].reps = 1; f.cards[3].lastRating = 4
    f.cards[4].qualityStatus = 'needs_work'; f.cards[4].reps = 1; f.cards[4].lastRating = 1

    expect(f.catalog().items[0].overview).toMatchObject({
      eligibleCards: 5,
      reviewedCards: 4,
      statusCounts: { notKnown: 1, partiallyKnown: 1, known: 2 }
    })
  })

  it('rejects invalid pages instead of returning unbounded results', () => {
    const f = fixture()
    for (const page of [0, -1, 1.5, NaN, Infinity]) expect(() => f.catalog('', page)).toThrow()
  })
})
