import type { RecordReviewInput, RecordReviewResult } from './ipc'
import type { ReviewCard } from './schemas'
import { STUDY_BATCH_SIZE, type StudyCommand, type StudyMode, type StudyOverview, type StudyResponse, type StudyRun } from './flashcardStudy'
import { buildStudyCatalog } from './studyCatalog'

export type StoredStudyRun = {
  id: string
  userId: string
  collectionId: string
  mode: StudyMode
  createdAt: string
  updatedAt: string
  cloudUpdatedAt?: string
  cloudSyncedLocalUpdatedAt?: string
  completion?: { total: number; completed: number; excluded: number } | null
  items: Array<{ cardId: string; completed: boolean; deferred: boolean }>
  actions: Array<{ eventId: string; cardId: string; review: RecordReviewResult; previous: unknown; undone: boolean }>
}

export type StudyContext = {
  userId: string
  runs: StoredStudyRun[]
  now(): string
  newId(): string
  collectionIds(): string[]
  collections?(): Array<{ id: string; name: string; subject: string | null }>
  cards(collectionId: string): ReviewCard[]
  capture(cardId: string): unknown
  record(input: RecordReviewInput): RecordReviewResult
  undo(review: RecordReviewResult, previous: unknown): void
}

const eligible = (card: ReviewCard): boolean => !card.isArchived && card.qualityStatus !== 'problematic' && card.qualityStatus !== 'needs_work'

/** All callbacks and mutations run inside the adapter's single durable transaction. */
export function executeStudyCommand(command: StudyCommand, context: StudyContext): StudyResponse {
  // Summarizing a run normally reconciles its completion. Catalog reads must not persist it.
  if (command.action === 'catalog') context = { ...context, runs: structuredClone(context.runs) }
  const response: StudyResponse = { overviews: [], run: null, cards: [], review: null }
  const collectionIds = context.collectionIds()
  const cardCache = new Map<string, ReviewCard[]>()
  const collectionCards = (id: string): ReviewCard[] => {
    if (!collectionIds.includes(id)) throw new Error('Diese Sammlung ist nicht verfügbar.')
    if (!cardCache.has(id)) cardCache.set(id, context.cards(id).filter((card) => card.collectionId === id))
    return cardCache.get(id)!
  }
  const available = (run: StoredStudyRun) => new Map(collectionCards(run.collectionId).filter(eligible).map((card) => [card.id, card]))
  const summarize = (run: StoredStudyRun): StudyRun => {
    const cards = available(run)
    // Another mode or device may have answered a card since this first pass started.
    if (run.mode === 'first_pass' && !run.completion) {
      const allCards = new Map(collectionCards(run.collectionId).map((card) => [card.id, card]))
      for (const item of run.items) {
        const card = allCards.get(item.cardId)
        if (card) item.completed = card.reps > 0
      }
    }
    const members = run.items.filter((item) => cards.has(item.cardId))
    const completed = members.filter((item) => item.completed).length
    if (!run.completion && completed === members.length) {
      run.completion = { total: members.length, completed, excluded: run.items.length - members.length }
    }
    const memberIds = new Set(run.items.map((item) => item.cardId))
    const closed = run.completion
    return {
      id: run.id, collectionId: run.collectionId, mode: run.mode,
      total: closed?.total ?? members.length, completed: closed?.completed ?? completed, remaining: closed ? 0 : members.length - completed,
      deferred: closed ? 0 : members.filter((item) => !item.completed && item.deferred).length,
      excluded: closed?.excluded ?? run.items.length - members.length,
      added: run.mode === 'first_pass' || run.mode === 'all' ? [...cards.keys()].filter((id) => !memberIds.has(id) || (closed && run.items.some((item) => item.cardId === id && !item.completed))).length : 0,
      status: closed ? 'completed' : 'active',
      createdAt: run.createdAt, updatedAt: run.updatedAt
    }
  }
  const ownRuns = () => context.runs.filter((run) => run.userId === context.userId)
  const overview = (collectionId: string, preferFirstPass = true): StudyOverview => {
    const allCards = collectionCards(collectionId).filter((card) => !card.isArchived)
    const cards = allCards.filter(eligible)
    const active = ownRuns().filter((run) => run.collectionId === collectionId)
      .map(summarize).filter((run) => run.status === 'active')
      .sort((a, b) => (preferFirstPass ? Number(!['first_pass', 'all'].includes(a.mode)) - Number(!['first_pass', 'all'].includes(b.mode)) : 0) || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
    return {
      collectionId, totalCards: allCards.length, eligibleCards: cards.length,
      reviewedCards: cards.filter((card) => card.reps > 0).length,
      newCards: cards.filter((card) => !card.reps).length,
      dueCards: cards.filter((card) => card.reps > 0 && card.dueAt <= context.now()).length,
      weakCards: cards.filter((card) => card.lastRating === 1 || card.lastRating === 2).length,
      pausedCards: allCards.length - cards.length, activeRun: active[0] ?? null
    }
  }

  if (command.action === 'catalog') {
    if (!context.collections) throw new Error('Sammlungsübersicht nicht verfügbar.')
    response.catalog = buildStudyCatalog(context.collections().filter(c => collectionIds.includes(c.id))
      .map(c => ({ id: c.id, name: c.name, subject: c.subject, overview: overview(c.id, false), defaultRun: overview(c.id).activeRun })), command.search, command.page)
    return response
  }

  if (command.action === 'overview') {
    response.overviews = (command.collectionId ? [command.collectionId] : collectionIds).map(id => overview(id))
    return response
  }

  let run: StoredStudyRun
  if (command.action === 'start') {
    if (!['first_pass', 'review', 'weak', 'all'].includes(command.mode)) throw new Error('Unbekannter Lernmodus.')
    const cards = collectionCards(command.collectionId).filter(eligible)
    const existing = ownRuns().filter((candidate) => candidate.collectionId === command.collectionId && candidate.mode === command.mode)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).find((candidate) => summarize(candidate).status === 'active')
    if (existing) run = existing
    else {
      const selected = cards.filter((card) => command.mode === 'review' ? card.reps > 0 && card.dueAt <= context.now() : command.mode === 'weak' ? card.lastRating === 1 || card.lastRating === 2 : true)
      selected.sort((a, b) => (command.mode === 'review' || command.mode === 'weak' ? a.dueAt.localeCompare(b.dueAt) : 0) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      run = { id: context.newId(), userId: context.userId, collectionId: command.collectionId, mode: command.mode, createdAt: context.now(), updatedAt: context.now(),
        items: selected.map((card) => ({ cardId: card.id, completed: command.mode === 'first_pass' && card.reps > 0, deferred: false })), actions: [] }
      context.runs.push(run)
    }
  } else {
    const found = ownRuns().find((candidate) => candidate.id === command.runId)
    if (!found) throw new Error('Dieser Durchgang ist nicht verfügbar.')
    run = found
  }
  summarize(run)

  if (command.action === 'rate' || command.action === 'defer') {
    const member = run.items.find((item) => item.cardId === command.cardId)
    const card = available(run).get(command.cardId)
    if (!member || !card) throw new Error('Diese Karte ist in diesem Durchgang nicht verfügbar.')
    if (command.action === 'rate') {
      const priorRun = ownRuns().find((candidate) => candidate.actions.some((action) => action.eventId === command.eventId))
      const prior = priorRun?.actions.find((action) => action.eventId === command.eventId)
      if (prior) {
        if (priorRun?.id !== run.id || prior.cardId !== command.cardId || prior.review.event.rating !== command.rating || prior.undone) throw new Error('Diese Bewertung wurde bereits anders verwendet.')
        response.review = prior.review
      } else {
        if (run.completion || member.completed || member.deferred) throw new Error('Diese Karte wurde bereits bearbeitet oder zurückgestellt. Lade den Durchgang erneut.')
        if (![1, 2, 3, 4].includes(command.rating)) throw new Error('Ungültige Bewertung.')
        const previous = context.capture(command.cardId)
        const review = context.record({ cardId: command.cardId, rating: command.rating, clientEventId: command.eventId, elapsedMs: command.elapsedMs })
        run.actions.push({ eventId: command.eventId, cardId: command.cardId, review, previous, undone: false })
        member.completed = true; member.deferred = false
        response.review = review
        cardCache.delete(run.collectionId)
      }
    } else if (!member.completed) member.deferred = true
  } else if (command.action === 'resume_deferred') {
    for (const item of run.items) if (!item.completed) item.deferred = false
  } else if (command.action === 'undo') {
    const action = run.actions.find((item) => item.eventId === command.eventId)
    if (!action) throw new Error('Diese Bewertung ist nicht verfügbar.')
    if (!action.undone) {
      context.undo(action.review, action.previous)
      run.completion = null
      action.undone = true
      const member = run.items.find((item) => item.cardId === action.cardId)!
      member.completed = false; member.deferred = false
      cardCache.delete(run.collectionId)
    }
  }
  if (command.action !== 'batch') run.updatedAt = context.now()
  response.run = summarize(run)
  const cards = available(run)
  response.cards = run.completion ? [] : run.items.filter((item) => !item.completed && !item.deferred && cards.has(item.cardId))
    .slice(0, STUDY_BATCH_SIZE).map((item) => cards.get(item.cardId)!)
  return response
}
