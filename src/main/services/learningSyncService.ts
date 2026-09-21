import type { ReviewRating } from '@shared/schemas'
import type { SqliteDatabase } from './database'

type Row = Record<string, unknown>

export type CloudLearningCollection = {
  id: string
  ownerUserId: string
  name: string
  description: string
  subject: string | null
  source: string | null
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

export type CloudLearningCard = {
  id: string
  itemId: string
  collectionId: string
  ownerUserId: string
  title: string
  externalId: string | null
  frontMarkdown: string
  backMarkdown: string
  tags: string[]
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

export type CloudLearningSchedule = {
  userId: string
  cardId: string
  dueAt: string
  reps: number
  lapses: number
  lastRating: ReviewRating | null
  lastReviewedAt: string | null
  updatedAt: string
}

export type CloudLearningReviewEvent = {
  id: string
  userId: string
  cardId: string
  rating: ReviewRating
  reviewedAt: string
  elapsedMs: number | null
  voidedAt?: string | null
}

export type CloudLearningCardQualityEvent = {
  id: string
  userId: string
  cardId: string
  status: 'good' | 'needs_work' | 'problematic'
  reasons: string[]
  note: string
  ratedAt: string
  createdAt: string
  updatedAt: string
}

export type CloudPodcastProgress = {
  userId: string
  episodeId: string
  positionSeconds: number
  durationSeconds: number
  completed: boolean
  lastPlayedAt: string | null
  updatedAt: string
}

export type CloudLearningSyncState = {
  collections: CloudLearningCollection[]
  cards: CloudLearningCard[]
  schedules: CloudLearningSchedule[]
  reviewEvents: CloudLearningReviewEvent[]
  qualityEvents: CloudLearningCardQualityEvent[]
  podcastProgress?: CloudPodcastProgress[]
}

export type LearningSyncMergeResult = {
  collectionsImportedOrUpdated: number
  cardsImportedOrUpdated: number
  schedulesImportedOrUpdated: number
  reviewEventsImported: number
  qualityEventsImported: number
  podcastProgressImportedOrUpdated: number
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function mergeCloudLearningStateIntoLocal(input: {
  db: SqliteDatabase
  localUserId: string
  cloudState: CloudLearningSyncState
  authoritativeProgress?: boolean
  protectedProgressCardIds?: ReadonlySet<string>
}): LearningSyncMergeResult {
  const result: LearningSyncMergeResult = {
    collectionsImportedOrUpdated: 0,
    cardsImportedOrUpdated: 0,
    schedulesImportedOrUpdated: 0,
    reviewEventsImported: 0,
    qualityEventsImported: 0,
    podcastProgressImportedOrUpdated: 0
  }

  input.db.transaction(() => {
    for (const collection of input.cloudState.collections) {
      if (collection.isArchived) continue
      const existing = input.db.prepare('SELECT updated_at FROM learning_collections WHERE id = ? AND user_id = ?').get(
        collection.id,
        input.localUserId
      ) as { updated_at: string } | undefined
      if (existing && existing.updated_at >= collection.updatedAt) continue
      input.db
        .prepare(
          `
          INSERT INTO learning_collections
            (id, user_id, name, description, subject, source, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            description = excluded.description,
            subject = excluded.subject,
            source = excluded.source,
            updated_at = excluded.updated_at
        `
        )
        .run(
          collection.id,
          input.localUserId,
          collection.name.trim() || 'Neue Sammlung',
          collection.description,
          collection.subject,
          collection.source,
          collection.createdAt,
          collection.updatedAt
        )
      result.collectionsImportedOrUpdated += 1
    }

    for (const card of input.cloudState.cards) {
      ensureCollectionExists(input.db, input.localUserId, card.collectionId, card.createdAt)
      const existing = input.db.prepare('SELECT updated_at FROM learning_cards WHERE id = ? AND user_id = ?').get(
        card.id,
        input.localUserId
      ) as { updated_at: string } | undefined
      if (!existing || existing.updated_at < card.updatedAt) {
        input.db
          .prepare(
            `
            INSERT INTO learning_cards
              (id, user_id, collection_id, external_id, title, front_markdown, back_markdown, is_archived, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              collection_id = excluded.collection_id,
              external_id = excluded.external_id,
              title = excluded.title,
              front_markdown = excluded.front_markdown,
              back_markdown = excluded.back_markdown,
              is_archived = excluded.is_archived,
              updated_at = excluded.updated_at
          `
          )
          .run(
            card.id,
            input.localUserId,
            card.collectionId,
            card.itemId,
            card.title.trim() || 'Neue Karte',
            card.frontMarkdown,
            card.backMarkdown,
            card.isArchived ? 1 : 0,
            card.createdAt,
            card.updatedAt
          )
        replaceCardTags(input.db, input.localUserId, card.id, card.tags)
        result.cardsImportedOrUpdated += 1
      }
    }

    for (const schedule of input.cloudState.schedules) {
      if (input.protectedProgressCardIds?.has(schedule.cardId)) continue
      const existing = input.db
        .prepare(`SELECT MAX(updated_at, COALESCE((SELECT MAX(voided_at) FROM learning_review_events
          WHERE user_id = learning_card_schedules.user_id AND card_id = learning_card_schedules.card_id), updated_at)) AS updated_at
          FROM learning_card_schedules WHERE user_id = ? AND card_id = ?`)
        .get(input.localUserId, schedule.cardId) as { updated_at: string } | undefined
      if (!input.authoritativeProgress && existing && existing.updated_at >= schedule.updatedAt) continue
      input.db
        .prepare(
          `
          INSERT INTO learning_card_schedules
            (user_id, card_id, due_at, reps, lapses, last_rating, last_reviewed_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, card_id) DO UPDATE SET
            due_at = excluded.due_at,
            reps = excluded.reps,
            lapses = excluded.lapses,
            last_rating = excluded.last_rating,
            last_reviewed_at = excluded.last_reviewed_at,
            updated_at = excluded.updated_at
        `
        )
        .run(
          input.localUserId,
          schedule.cardId,
          schedule.dueAt,
          schedule.reps,
          schedule.lapses,
          schedule.lastRating,
          schedule.lastReviewedAt,
          schedule.updatedAt
        )
      result.schedulesImportedOrUpdated += 1
    }

    if (input.authoritativeProgress) {
      const scheduledCardIds = new Set(input.cloudState.schedules.map(schedule => schedule.cardId))
      const removeSchedule = input.db.prepare('DELETE FROM learning_card_schedules WHERE user_id = ? AND card_id = ?')
      // Absence is meaningful after undo. Restrict deletion to cards actually returned by the cloud.
      for (const card of input.cloudState.cards) {
        if (!scheduledCardIds.has(card.id) && !input.protectedProgressCardIds?.has(card.id)) {
          result.schedulesImportedOrUpdated += removeSchedule.run(input.localUserId, card.id).changes
        }
      }
    }

    for (const event of input.cloudState.reviewEvents) {
      const insert = input.db
        .prepare(
          `
          INSERT INTO learning_review_events
            (id, user_id, card_id, rating, reviewed_at, elapsed_ms, voided_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET voided_at = excluded.voided_at
          WHERE learning_review_events.user_id = excluded.user_id
            AND excluded.voided_at IS NOT NULL
            AND (learning_review_events.voided_at IS NULL OR excluded.voided_at > learning_review_events.voided_at)
        `
        )
        .run(event.id, input.localUserId, event.cardId, event.rating, event.reviewedAt, event.elapsedMs, event.voidedAt ?? null)
      result.reviewEventsImported += insert.changes
    }

    for (const event of input.cloudState.qualityEvents) {
      const insert = input.db
        .prepare(
          `
          INSERT OR IGNORE INTO learning_card_quality_events
            (id, user_id, card_id, status, reasons_json, note, rated_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        )
        .run(
          event.id,
          input.localUserId,
          event.cardId,
          event.status,
          JSON.stringify(event.reasons),
          event.note,
          event.ratedAt,
          event.createdAt,
          event.updatedAt
        )
      result.qualityEventsImported += insert.changes
    }

    for (const progress of input.cloudState.podcastProgress ?? []) {
      const existing = input.db
        .prepare(
          `
          SELECT position_seconds, duration_seconds, completed, updated_at
          FROM podcast_episode_progress
          WHERE user_id = ? AND episode_id = ?
        `
        )
        .get(input.localUserId, progress.episodeId) as
        | {
            position_seconds: number
            duration_seconds: number
            completed: number
            updated_at: string
          }
        | undefined
      if (
        existing &&
        (existing.updated_at > progress.updatedAt ||
          (existing.updated_at === progress.updatedAt &&
            Number(existing.position_seconds) >= progress.positionSeconds &&
            (Boolean(existing.completed) || !progress.completed)))
      ) {
        continue
      }
      input.db
        .prepare(
          `
          INSERT INTO podcast_episode_progress
            (user_id, episode_id, position_seconds, duration_seconds, completed, last_played_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, episode_id) DO UPDATE SET
            position_seconds = excluded.position_seconds,
            duration_seconds = MAX(podcast_episode_progress.duration_seconds, excluded.duration_seconds),
            completed = podcast_episode_progress.completed OR excluded.completed,
            last_played_at = excluded.last_played_at,
            updated_at = excluded.updated_at
        `
        )
        .run(
          input.localUserId,
          progress.episodeId,
          progress.positionSeconds,
          progress.durationSeconds,
          progress.completed ? 1 : 0,
          progress.lastPlayedAt,
          progress.updatedAt
        )
      result.podcastProgressImportedOrUpdated += 1
    }
  })()

  return result
}

export function buildCloudLearningStateFromLocal(input: {
  db: SqliteDatabase
  localUserId: string
  remoteUserId: string
}): CloudLearningSyncState {
  const collections = (input.db
    .prepare('SELECT * FROM learning_collections WHERE user_id = ?')
    .all(input.localUserId) as Row[]).map((row): CloudLearningCollection => ({
    id: String(row.id),
    ownerUserId: input.remoteUserId,
    name: String(row.name),
    description: String(row.description ?? ''),
    subject: row.subject ? String(row.subject) : null,
    source: row.source ? String(row.source) : null,
    isArchived: false,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  }))

  const cards = (input.db
    .prepare('SELECT * FROM learning_cards WHERE user_id = ?')
    .all(input.localUserId) as Row[]).map((row): CloudLearningCard => {
    const externalId = row.external_id ? String(row.external_id) : null
    return {
      id: String(row.id),
      itemId: externalId && UUID_PATTERN.test(externalId) ? externalId : String(row.id),
      collectionId: String(row.collection_id),
      ownerUserId: input.remoteUserId,
      title: String(row.title),
      externalId: externalId && externalId !== String(row.id) ? externalId : String(row.id),
      frontMarkdown: String(row.front_markdown),
      backMarkdown: String(row.back_markdown),
      tags: listTagsForCard(input.db, input.localUserId, String(row.id)),
      isArchived: Number(row.is_archived) === 1,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at)
    }
  })

  const schedules = (input.db
    .prepare(`SELECT s.*, MAX(s.updated_at, COALESCE((SELECT MAX(voided_at) FROM learning_review_events e
      WHERE e.user_id = s.user_id AND e.card_id = s.card_id), s.updated_at)) AS sync_updated_at
      FROM learning_card_schedules s WHERE s.user_id = ?`)
    .all(input.localUserId) as Row[]).map((row): CloudLearningSchedule => ({
    userId: input.remoteUserId,
    cardId: String(row.card_id),
    dueAt: String(row.due_at),
    reps: Number(row.reps),
    lapses: Number(row.lapses),
    lastRating: row.last_rating === null || row.last_rating === undefined ? null : (Number(row.last_rating) as ReviewRating),
    lastReviewedAt: row.last_reviewed_at ? String(row.last_reviewed_at) : null,
    updatedAt: String(row.sync_updated_at)
  }))

  const reviewEvents = (input.db
    .prepare('SELECT * FROM learning_review_events WHERE user_id = ?')
    .all(input.localUserId) as Row[]).map((row): CloudLearningReviewEvent => ({
    id: String(row.id),
    userId: input.remoteUserId,
    cardId: String(row.card_id),
    rating: Number(row.rating) as ReviewRating,
    reviewedAt: String(row.reviewed_at),
    elapsedMs: row.elapsed_ms === null || row.elapsed_ms === undefined ? null : Number(row.elapsed_ms),
    voidedAt: row.voided_at ? String(row.voided_at) : null
  }))

  const qualityEvents = (input.db
    .prepare('SELECT * FROM learning_card_quality_events WHERE user_id = ?')
    .all(input.localUserId) as Row[]).map((row): CloudLearningCardQualityEvent => ({
    id: String(row.id),
    userId: input.remoteUserId,
    cardId: String(row.card_id),
    status: String(row.status) as CloudLearningCardQualityEvent['status'],
    reasons: JSON.parse(String(row.reasons_json ?? '[]')) as string[],
    note: String(row.note ?? ''),
    ratedAt: String(row.rated_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  }))

  const podcastProgress = (input.db
    .prepare('SELECT * FROM podcast_episode_progress WHERE user_id = ?')
    .all(input.localUserId) as Row[]).map((row): CloudPodcastProgress => ({
    userId: input.remoteUserId,
    episodeId: String(row.episode_id),
    positionSeconds: Number(row.position_seconds),
    durationSeconds: Number(row.duration_seconds),
    completed: Boolean(row.completed),
    lastPlayedAt: row.last_played_at ? String(row.last_played_at) : null,
    updatedAt: String(row.updated_at)
  }))

  return { collections, cards, schedules, reviewEvents, qualityEvents, podcastProgress }
}

function ensureCollectionExists(db: SqliteDatabase, localUserId: string, collectionId: string, createdAt: string): void {
  const existing = db.prepare('SELECT id FROM learning_collections WHERE id = ? AND user_id = ?').get(collectionId, localUserId)
  if (existing) return
  db
    .prepare(
      `
      INSERT INTO learning_collections
        (id, user_id, name, description, subject, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
    .run(collectionId, localUserId, 'Online-Sammlung', '', null, null, createdAt, createdAt)
}

function replaceCardTags(db: SqliteDatabase, localUserId: string, cardId: string, tags: string[]): void {
  db.prepare('DELETE FROM learning_card_tags WHERE card_id = ? AND user_id = ?').run(cardId, localUserId)
  const uniqueTags = [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))]
  for (const tag of uniqueTags) {
    db
      .prepare('INSERT OR IGNORE INTO learning_card_tags (user_id, card_id, tag) VALUES (?, ?, ?)')
      .run(localUserId, cardId, tag)
  }
}

function listTagsForCard(db: SqliteDatabase, localUserId: string, cardId: string): string[] {
  const rows = db
    .prepare('SELECT tag FROM learning_card_tags WHERE user_id = ? AND card_id = ? ORDER BY tag ASC')
    .all(localUserId, cardId) as Array<{ tag: string }>
  return rows.map((row) => row.tag)
}
