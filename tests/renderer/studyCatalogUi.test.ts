import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StudyCatalog, StudyCollection } from '../../src/shared/flashcardStudy'

const navigationPath = '../../src/renderer/src/ui/studyCatalogNavigation'
const loaderPath = '../../src/renderer/src/ui/studyCatalogLoader'
const { recommendationEntry, collectionEntry } = await import(/* @vite-ignore */ navigationPath)
const { createStudyCatalogLoader } = await import(/* @vite-ignore */ loaderPath)

const collection: StudyCollection = {
  id: 'c', name: 'Baurecht', subject: null, defaultRun: null,
  overview: { collectionId: 'c', totalCards: 10, eligibleCards: 10, reviewedCards: 4, newCards: 6, dueCards: 3, weakCards: 0, pausedCards: 0,
    statusCounts: { notKnown: 1, partiallyKnown: 1, known: 2 },
    activeRun: { id: 'run', collectionId: 'c', mode: 'first_pass', total: 10, completed: 4, remaining: 6, deferred: 6, excluded: 0, added: 0, status: 'active', createdAt: 'now', updatedAt: 'now' } }
}
const catalog: StudyCatalog = { items: [collection], total: 1, collectionCount: 1, eligibleCollectionCount: 1, recommendation: { kind: 'review', collection } }
const empty: StudyCatalog = { items: [], total: 0, collectionCount: 0, eligibleCollectionCount: 0, recommendation: null }

describe('catalog navigation', () => {
  it('preserves the tile first-pass action when the global recommendation resumes a newer review', () => {
    const candidate = { ...collection, defaultRun: collection.overview.activeRun,
      overview: { ...collection.overview, activeRun: { ...collection.overview.activeRun!, id: 'new-review', mode: 'review' as const } } }
    expect(collectionEntry(candidate).query).toMatchObject({ run: 'run', mode: 'first_pass' })
    expect(recommendationEntry({ kind: 'resume', collection: candidate }).query).toMatchObject({ run: 'new-review', mode: 'review' })
  })
  it('opens due reviews explicitly even while a first pass is active', () => {
    expect(recommendationEntry({ kind: 'review', collection })).toMatchObject({ label: 'Jetzt wiederholen', query: { collection: 'c', mode: 'review' } })
    expect(recommendationEntry({ kind: 'review', collection }).query).not.toHaveProperty('run')
  })
  it('resumes the exact run and names deferred cards', () => {
    expect(recommendationEntry({ kind: 'resume', collection })).toMatchObject({ query: { collection: 'c', run: 'run', mode: 'first_pass' }, reason: expect.stringContaining('zurückgestellte') })
  })
  it('starts a first pass for new cards and gives a count rather than invented minutes', () => {
    expect(recommendationEntry({ kind: 'new', collection })).toMatchObject({ query: { collection: 'c', mode: 'first_pass' }, reason: 'Noch 6 Karten erstmals bearbeiten.' })
  })
})

describe('catalog request ordering', () => {
  afterEach(() => vi.useRealTimers())
  it('invalidates an in-flight response immediately, before the debounce expires', async () => {
    vi.useFakeTimers()
    let finish!: (value: StudyCatalog) => void
    const loader = createStudyCatalogLoader((search: string) => search === 'old' ? new Promise<StudyCatalog>(resolve => { finish = resolve }) : Promise.resolve(empty))
    const first = loader.request('old', 1)
    loader.request('new', 1, 250)
    finish(catalog); await first
    expect(loader.catalog.value).toBeNull()
    expect(loader.loading.value).toBe(true)
    await vi.advanceTimersByTimeAsync(250)
    expect(loader.catalog.value).toEqual(empty)
    expect(loader.loading.value).toBe(false)
  })
  it('keeps errors visible, supports retry, and does not update after disposal', async () => {
    let attempt = 0
    const loader = createStudyCatalogLoader(async () => { if (++attempt === 1) throw new Error('offline'); return catalog })
    await loader.request('', 1)
    expect(loader.error.value).toBeTruthy()
    expect(loader.catalog.value).toBeNull()
    await loader.request('', 1)
    expect(loader.error.value).toBe('')
    expect(loader.catalog.value).toEqual(catalog)
    let finish!: (value: StudyCatalog) => void
    const other = createStudyCatalogLoader(() => new Promise<StudyCatalog>(resolve => { finish = resolve }))
    const pending = other.request('', 1); other.dispose(); finish(catalog); await pending
    expect(other.catalog.value).toBeNull()
  })
})
