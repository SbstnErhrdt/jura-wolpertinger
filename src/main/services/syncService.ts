import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { SyncRunAction, SyncRunResult } from '@shared/schemas'
import { syncRunResultSchema } from '@shared/schemas'
import type { SqliteDatabase } from './database'
import { nowIso } from './utils'

type Row = Record<string, unknown>

export type WorkspaceSnapshotFile = {
  attachmentId: string
  relativePath: string
  storagePath: string
  localPath: string
  size: number
}

export type WorkspaceSnapshot = {
  snapshotVersion: 1
  localUserId: string
  exportedAt: string
  tables: Record<string, Row[]>
  files: WorkspaceSnapshotFile[]
}

const SNAPSHOT_VERSION = 1

const USER_SYNC_TABLES = [
  'users',
  'folders',
  'tags',
  'exam_tags',
  'exams',
  'exam_revisions',
  'submissions',
  'corrections',
  'inline_comments',
  'attachments',
  'learning_tasks',
  'learning_collections',
  'learning_cards',
  'learning_card_tags',
  'learning_review_events',
  'learning_card_schedules',
  'learning_card_quality_events'
] as const

const RESTORE_DELETE_ORDER = [
  'learning_card_quality_events',
  'learning_card_schedules',
  'learning_review_events',
  'learning_card_tags',
  'learning_cards',
  'learning_collections',
  'learning_tasks',
  'inline_comments',
  'corrections',
  'submissions',
  'exam_revisions',
  'attachments',
  'exam_tags',
  'tags',
  'exams',
  'folders'
] as const

export function createWorkspaceSnapshot(input: {
  db: SqliteDatabase
  filesDir: string
  localUserId: string
  remoteUserId: string
}): WorkspaceSnapshot {
  const tables: Record<string, Row[]> = {}
  for (const table of USER_SYNC_TABLES) {
    tables[table] = selectUserRows(input.db, table, input.localUserId)
  }

  const files = tables.attachments.map((row) => {
    const relativePath = String(row.relative_path)
    const attachmentId = String(row.id)
    return {
      attachmentId,
      relativePath,
      storagePath: storagePathForAttachment(input.remoteUserId, input.localUserId, attachmentId, String(row.stored_name)),
      localPath: join(input.filesDir, relativePath),
      size: Number(row.size)
    }
  })

  return {
    snapshotVersion: SNAPSHOT_VERSION,
    localUserId: input.localUserId,
    exportedAt: nowIso(),
    tables,
    files
  }
}

export async function writeSnapshotFiles(input: {
  filesDir: string
  snapshot: WorkspaceSnapshot
  filePayloads: Array<{ relativePath: string; bytes: Uint8Array }>
}): Promise<number> {
  let written = 0
  for (const file of input.filePayloads) {
    const filePath = join(input.filesDir, file.relativePath)
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, file.bytes)
    written += 1
  }
  return written
}

export async function readExistingSnapshotFiles(snapshot: WorkspaceSnapshot): Promise<Array<{
  file: WorkspaceSnapshotFile
  bytes: Uint8Array
}>> {
  const payloads: Array<{ file: WorkspaceSnapshotFile; bytes: Uint8Array }> = []
  for (const file of snapshot.files) {
    if (!existsSync(file.localPath)) continue
    payloads.push({
      file,
      bytes: await readFile(file.localPath)
    })
  }
  return payloads
}

export function restoreWorkspaceSnapshot(input: {
  db: SqliteDatabase
  snapshot: WorkspaceSnapshot
  targetUserId?: string
}): SyncRunResult {
  const localUserId = input.targetUserId ?? input.snapshot.localUserId
  const tableCounts = countSnapshotTables(input.snapshot)

  input.db.transaction(() => {
    for (const table of RESTORE_DELETE_ORDER) {
      input.db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(localUserId)
    }
    for (const table of USER_SYNC_TABLES) {
      const rows = input.snapshot.tables[table] ?? []
      for (const row of rows) {
        insertOrReplaceRow(input.db, table, remapSnapshotRow(row, localUserId))
      }
    }
    input.db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('current_user_id', localUserId)
  })()

  const syncedAt = nowIso()
  return syncRunResultSchema.parse({
    action: 'download',
    syncedAt,
    summary: 'Online-Daten wurden auf dieses Gerät geladen.',
    uploadedFiles: 0,
    downloadedFiles: input.snapshot.files.length,
    tableCounts
  })
}

export function createSyncResult(input: {
  action: SyncRunAction
  summary: string
  uploadedFiles: number
  downloadedFiles: number
  snapshot: WorkspaceSnapshot
}): SyncRunResult {
  return syncRunResultSchema.parse({
    action: input.action,
    syncedAt: nowIso(),
    summary: input.summary,
    uploadedFiles: input.uploadedFiles,
    downloadedFiles: input.downloadedFiles,
    tableCounts: countSnapshotTables(input.snapshot)
  })
}

function selectUserRows(db: SqliteDatabase, table: string, userId: string): Row[] {
  if (table === 'users') {
    return db.prepare('SELECT * FROM users WHERE id = ?').all(userId) as Row[]
  }
  return db.prepare(`SELECT * FROM ${table} WHERE user_id = ?`).all(userId) as Row[]
}

function remapSnapshotRow(row: Row, targetUserId: string): Row {
  if ('id' in row && !('user_id' in row)) {
    return { ...row, id: targetUserId }
  }
  if (!('user_id' in row)) return row
  return { ...row, user_id: targetUserId }
}

function insertOrReplaceRow(db: SqliteDatabase, table: string, row: Row): void {
  const columns = Object.keys(row)
  const placeholders = columns.map(() => '?').join(', ')
  const quotedColumns = columns.map((column) => `"${column}"`).join(', ')
  db.prepare(`INSERT OR REPLACE INTO ${table} (${quotedColumns}) VALUES (${placeholders})`).run(
    ...columns.map((column) => row[column])
  )
}

function countSnapshotTables(snapshot: WorkspaceSnapshot): Record<string, number> {
  return Object.fromEntries(
    Object.entries(snapshot.tables).map(([table, rows]) => [table, rows.length])
  )
}

function storagePathForAttachment(
  remoteUserId: string,
  localUserId: string,
  attachmentId: string,
  storedName: string
): string {
  return `users/${remoteUserId}/workspaces/${localUserId}/attachments/${attachmentId}/${storedName}`
}
