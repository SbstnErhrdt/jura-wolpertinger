import { executeStudyCommand, type StoredStudyRun, type StudyContext } from '@shared/flashcardStudyEngine'
import type { StudyCommand, StudyResponse } from '@shared/flashcardStudy'
import type { SqliteDatabase } from './database'
import { newId, nowIso } from './utils'

type Schedule = {
  user_id: string; card_id: string; due_at: string; reps: number; lapses: number
  last_rating: number | null; last_reviewed_at: string | null; updated_at: string
}

/** Review history, schedules and traversal state commit atomically. */
export function studyFlashcardsInDatabase(
  db: SqliteDatabase,
  command: StudyCommand,
  adapter: Pick<StudyContext, 'userId' | 'collectionIds' | 'collections' | 'cards' | 'record'>
): StudyResponse {
  return db.transaction(() => {
    const runs = (db.prepare('SELECT run_json FROM learning_study_runs WHERE user_id = ?')
      .all(adapter.userId) as Array<{ run_json: string }>).map(row => JSON.parse(row.run_json) as StoredStudyRun)
    const previousStates = new Map(runs.map(run => [run.id, JSON.stringify({ items: run.items, actions: run.actions, completion: run.completion })]))
    const response = executeStudyCommand(command, {
      ...adapter, runs, now: nowIso, newId,
      capture: cardId => db.prepare('SELECT * FROM learning_card_schedules WHERE user_id = ? AND card_id = ?')
        .get(adapter.userId, cardId) ?? null,
      undo: (review, previous) => {
        const latest = db.prepare(`SELECT id FROM learning_review_events
          WHERE user_id = ? AND card_id = ? AND voided_at IS NULL
          ORDER BY reviewed_at DESC, rowid DESC LIMIT 1`).get(adapter.userId, review.event.cardId) as { id: string } | undefined
        if (latest?.id !== review.event.id) throw new Error('Eine spätere Bewertung verhindert das Rückgängigmachen.')
        db.prepare('UPDATE learning_review_events SET voided_at = ? WHERE id = ? AND user_id = ?')
          .run(nowIso(), review.event.id, adapter.userId)
        const schedule = previous as Schedule | null
        if (schedule) {
          db.prepare(`INSERT INTO learning_card_schedules
            (user_id, card_id, due_at, reps, lapses, last_rating, last_reviewed_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, card_id) DO UPDATE SET due_at = excluded.due_at,
              reps = excluded.reps, lapses = excluded.lapses, last_rating = excluded.last_rating,
              last_reviewed_at = excluded.last_reviewed_at, updated_at = excluded.updated_at`)
            .run(adapter.userId, review.event.cardId, schedule.due_at, schedule.reps, schedule.lapses,
              schedule.last_rating, schedule.last_reviewed_at, schedule.updated_at)
        } else {
          db.prepare('DELETE FROM learning_card_schedules WHERE user_id = ? AND card_id = ?')
            .run(adapter.userId, review.event.cardId)
        }
      }
    })
    if (command.action === 'catalog') return response
    const save = db.prepare(`INSERT INTO learning_study_runs (id, user_id, collection_id, run_json)
      VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET run_json = excluded.run_json
      WHERE learning_study_runs.user_id = excluded.user_id`)
    for (const run of runs) {
      // Explicitly invalidate the clean baseline even if two commands share a millisecond.
      if (previousStates.get(run.id) !== JSON.stringify({ items: run.items, actions: run.actions, completion: run.completion })) {
        delete run.cloudSyncedLocalUpdatedAt
      }
      save.run(run.id, adapter.userId, run.collectionId, JSON.stringify(run))
    }
    return response
  })()
}
