import { describe, expect, it } from 'vitest'
import type { StudyCommand, StudyResponse } from '../../src/shared/flashcardStudy'
const celebrationPath = '../../src/renderer/src/ui/studyCelebration'
const sessionPath = '../../src/renderer/src/ui/studySession'
const { createStudyCelebration } = await import(/* @vite-ignore */ celebrationPath)
const { createStudySession } = await import(/* @vite-ignore */ sessionPath)

function memoryStorage() {
  const data = new Map<string, string>()
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } }
}

function response(n: number, total = 30, runId = 'run', userId = 'user'): StudyResponse {
  return { overviews: [], cards: [], run: { id: runId, collectionId: 'collection', mode: 'first_pass', total,
    completed: n, remaining: total - n, deferred: 0, excluded: 0, added: 0,
    status: n === total ? 'completed' : 'active', createdAt: '2026-09-15T10:00:00Z', updatedAt: '2026-09-15T10:00:00Z' },
    review: { event: { schemaVersion: 1, id: `event-${n}`, userId, cardId: `card-${n}`, rating: 1,
      reviewedAt: '2026-09-15T10:00:00Z', elapsedMs: null }, nextDueAt: '2026-09-16T10:00:00Z', intervalLabel: 'Morgen' } }
}

function rate(n: number, runId = 'run'): Extract<StudyCommand, { action: 'rate' }> {
  return { action: 'rate', runId, cardId: `card-${n}`, eventId: `event-${n}`, rating: n % 3 + 1 as 1 | 2 | 3 }
}

describe('Wolpi motivation from confirmed study actions', () => {
  it('celebrates each ten distinct rated cards regardless of rating, then advances the picture', () => {
    const reward = createStudyCelebration(memoryStorage())
    for (let n = 1; n < 10; n++) expect(reward.apply('user', rate(n), response(n)).milestone).toBeNull()
    const ten = reward.apply('user', rate(10), response(10))
    expect(ten.count).toBe(10)
    expect(ten.milestone?.count).toBe(10)
    for (let n = 11; n < 20; n++) reward.apply('user', rate(n), response(n))
    const twenty = reward.apply('user', rate(20), response(20))
    expect(twenty.milestone?.imageUrl).not.toBe(ten.milestone?.imageUrl)
  })

  it('does not count deferred cards, loading, missing confirmations or duplicate events/cards', () => {
    const reward = createStudyCelebration(memoryStorage())
    expect(reward.apply('user', { action: 'batch', runId: 'run' }, response(9)).count).toBe(0)
    expect(reward.apply('user', { action: 'defer', runId: 'run', cardId: 'card' }, response(9)).count).toBe(0)
    expect(reward.apply('user', rate(1), { ...response(1), review: null }).count).toBe(0)
    reward.apply('user', rate(1), response(1))
    expect(reward.apply('user', rate(1), response(1)).count).toBe(1)
    const repeated = response(1)
    repeated.review!.event.id = 'another-event'
    expect(reward.apply('user', { ...rate(1), action: 'rate', eventId: 'another-event', cardId: 'card-1', rating: 3 }, repeated).count).toBe(1)
  })

  it('preserves progress on reload and does not repeat a milestone after undo and rerating', () => {
    const storage = memoryStorage()
    let reward = createStudyCelebration(storage)
    for (let n = 1; n < 10; n++) reward.apply('user', rate(n), response(n))
    reward = createStudyCelebration(storage)
    expect(reward.apply('user', { action: 'batch', runId: 'run' }, response(9)).milestone).toBeNull()
    expect(reward.apply('user', rate(10), response(10)).milestone?.count).toBe(10)
    expect(reward.apply('user', { action: 'undo', runId: 'run', eventId: 'event-10' }, response(9)).count).toBe(9)
    reward = createStudyCelebration(storage)
    const rerated = response(10); rerated.review!.event.id = 'rerated-10'
    const result = reward.apply('user', { action: 'rate', runId: 'run', cardId: 'card-10', eventId: 'rerated-10', rating: 3 }, rerated)
    expect(result.count).toBe(10)
    expect(result.milestone).toBeNull()
  })

  it('keeps users and runs separate, but rotates images across runs for the same user', () => {
    const reward = createStudyCelebration(memoryStorage())
    let first
    for (let n = 1; n <= 10; n++) first = reward.apply('user', rate(n), response(n))
    expect(reward.apply('other-user', rate(1), response(1, 30, 'run', 'other-user')).count).toBe(1)
    let second
    for (let n = 1; n <= 10; n++) second = reward.apply('user', rate(n, 'other-run'), response(n, 30, 'other-run'))
    expect(second?.milestone?.count).toBe(10)
    expect(second?.milestone?.imageUrl).not.toBe(first?.milestone?.imageUrl)
  })

  it('shows only the permanent completion at a threshold and also celebrates small collections', () => {
    const storage = memoryStorage()
    const reward = createStudyCelebration(storage)
    for (let n = 1; n < 10; n++) reward.apply('user', rate(n), response(n, 10))
    const done = reward.apply('user', rate(10), response(10, 10))
    expect(done.milestone).toBeNull()
    expect(done.completion?.imageUrl).toMatch(/wolpi-\d\d\.webp$/)
    const loaded = createStudyCelebration(storage).apply('user', { action: 'batch', runId: 'run' }, response(10, 10))
    expect(loaded.completion).toEqual(done.completion)
    expect(reward.apply('user', rate(1, 'small'), response(1, 1, 'small')).completion?.count).toBe(1)
    expect(reward.apply('user', { action: 'batch', runId: 'empty' }, { ...response(0, 0, 'empty'), review: null }).completion).toBeNull()
  })

  it('ignores mismatched identities and remains usable when storage is unavailable or corrupt', () => {
    const reward = createStudyCelebration({ getItem() { throw new Error('blocked') }, setItem() { throw new Error('quota') } })
    expect(reward.apply('user', rate(1), response(1, 30, 'run', 'someone-else')).count).toBe(0)
    for (let n = 1; n < 10; n++) reward.apply('user', rate(n), response(n))
    expect(reward.apply('user', rate(10), response(10)).milestone?.count).toBe(10)
    const corrupt = createStudyCelebration({ getItem: () => '{broken', setItem() {} })
    expect(corrupt.apply('user', rate(1), response(1)).count).toBe(1)
  })

  it('publishes successful session actions once and leaves failed saves uncelebrated until retry', async () => {
    let fail = true
    const session = createStudySession(async () => {
      if (fail) throw new Error('offline')
      return response(10)
    })
    expect(await session.send(rate(10))).toBe(false)
    expect(session.applied.value).toBeNull()
    fail = false
    expect(await session.retry()).toBe(true)
    expect(session.applied.value?.command).toEqual(rate(10))
    expect(session.applied.value?.response.review?.event.id).toBe('event-10')
  })
})
