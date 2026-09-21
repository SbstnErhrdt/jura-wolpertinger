import type { StoredStudyRun } from '@shared/flashcardStudyEngine'
import type { SqliteDatabase } from './database'

const CONFLICT = 'Der Durchgang wurde lokal und auf einem anderen Gerät geändert. Deine lokalen Änderungen bleiben erhalten. Lade die Online-Daten ausdrücklich neu, um den dortigen Stand zu übernehmen.'

export function loadStudyRuns(db: SqliteDatabase, userId: string): StoredStudyRun[] {
  return (db.prepare('SELECT run_json FROM learning_study_runs WHERE user_id = ?').all(userId) as Array<{ run_json: string }>)
    .map(row => JSON.parse(row.run_json) as StoredStudyRun)
}

function saveRun(db: SqliteDatabase, run: StoredStudyRun): void {
  const result = db.prepare(`INSERT INTO learning_study_runs(id, user_id, collection_id, run_json)
    VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET run_json = excluded.run_json
    WHERE learning_study_runs.user_id = excluded.user_id`)
    .run(run.id, run.userId, run.collectionId, JSON.stringify(run))
  if (result.changes !== 1) throw new Error('Dieser Durchgang gehört zu einem anderen lokalen Nutzer.')
}

const dirty = (run: StoredStudyRun) => !run.cloudSyncedLocalUpdatedAt || run.updatedAt !== run.cloudSyncedLocalUpdatedAt

export type StudySyncPlan = {
  uploads: StoredStudyRun[]
  downloads: Array<{ remote: StoredStudyRun; local?: StoredStudyRun }>
}

/** Check every revision before uploading reviews or overwriting local membership. */
export function planStudySync(localRuns: StoredStudyRun[], remoteRuns: StoredStudyRun[], replace = false): StudySyncPlan {
  const plan: StudySyncPlan = { uploads: [], downloads: [] }
  const remoteById = new Map(remoteRuns.map(run => [run.id, run]))
  const localById = new Map(localRuns.map(run => [run.id, run]))
  for (const local of localRuns) {
    const remote = remoteById.get(local.id)
    if (replace) continue
    if (!remote) {
      // A previously known run disappearing can mean access was revoked.
      if (local.cloudUpdatedAt) throw new Error(CONFLICT)
      plan.uploads.push(local)
    } else if (remote.updatedAt !== local.cloudUpdatedAt) {
      if (dirty(local)) throw new Error(CONFLICT)
      plan.downloads.push({ remote, local })
    } else if (dirty(local)) plan.uploads.push(local)
  }
  for (const remote of remoteRuns) {
    const local = localById.get(remote.id)
    if (replace || !local) plan.downloads.push({ remote, local })
  }
  return plan
}

export function applyStudyDownloads(db: SqliteDatabase, userId: string, plan: StudySyncPlan, replace = false): void {
  db.transaction(() => {
    const currentById = new Map(loadStudyRuns(db, userId).map(run => [run.id, run]))
    for (const entry of plan.downloads) {
      const current = currentById.get(entry.remote.id)
      if (!replace && JSON.stringify(current) !== JSON.stringify(entry.local)) throw new Error(CONFLICT)
      saveRun(db, {
        ...entry.remote, userId, actions: entry.local?.actions ?? current?.actions ?? [],
        // Keep the PostgreSQL timestamp string intact: Date would truncate CAS microseconds.
        cloudUpdatedAt: entry.remote.updatedAt,
        cloudSyncedLocalUpdatedAt: entry.remote.updatedAt
      })
    }
  })()
}

export function acknowledgeStudyUpload(db: SqliteDatabase, userId: string, sent: StoredStudyRun, remote: StoredStudyRun): void {
  db.transaction(() => {
    const current = loadStudyRuns(db, userId).find(run => run.id === sent.id)
    if (!current) throw new Error(CONFLICT)
    // A learner may have kept working while the network request was pending.
    const unchanged = current.updatedAt === sent.updatedAt && JSON.stringify(current.items) === JSON.stringify(sent.items)
      && JSON.stringify(current.actions) === JSON.stringify(sent.actions)
      && JSON.stringify(current.completion) === JSON.stringify(sent.completion)
    saveRun(db, { ...current, cloudUpdatedAt: remote.updatedAt,
      cloudSyncedLocalUpdatedAt: unchanged ? current.updatedAt : undefined })
  })()
}
