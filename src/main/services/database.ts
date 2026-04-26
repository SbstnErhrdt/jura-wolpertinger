import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { APP_VERSION, DATABASE_SCHEMA_VERSION } from '@shared/constants'
import { nowIso } from './utils'

export type SqliteDatabase = Database.Database

export function openDatabase(dbPath: string): SqliteDatabase {
  mkdirSync(dirname(dbPath), { recursive: true })
  const db = new Database(dbPath)
  db.pragma('foreign_keys = ON')
  initializeDatabase(db)
  return db
}

export function initializeDatabase(db: SqliteDatabase): void {
  const hasMeta = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'meta'")
    .get()

  if (!hasMeta) {
    createSchema(db)
    return
  }

  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined
  const version = Number(row?.value ?? 0)

  if (version === 1 && DATABASE_SCHEMA_VERSION === 2) {
    migrateV1ToV2(db)
    return
  }

  if (version === DATABASE_SCHEMA_VERSION) {
    repairMissingUserScope(db)
    updateAppVersion(db)
    return
  }

  if (version !== DATABASE_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported database schema ${version}. Expected schema ${DATABASE_SCHEMA_VERSION}.`
    )
  }
}

function updateAppVersion(db: SqliteDatabase): void {
  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('app_version', APP_VERSION)
}

function createSchema(db: SqliteDatabase): void {
  const createdAt = nowIso()

  db.transaction(() => {
    db.exec(`
      CREATE TABLE meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        kind TEXT NOT NULL,
        remote_user_id TEXT,
        onboarding_completed_at TEXT,
        tour_completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE folders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        parent_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
        trashed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE exams (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
        status TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        current_revision_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE exam_revisions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        kind TEXT NOT NULL,
        content_format TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        content_json TEXT NOT NULL
      );

      CREATE TABLE submissions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
        submitted_at TEXT NOT NULL,
        revision_id TEXT NOT NULL REFERENCES exam_revisions(id) ON DELETE RESTRICT,
        content_hash TEXT NOT NULL,
        pdf_path TEXT
      );

      CREATE TABLE corrections (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        score_points INTEGER,
        grading_comment TEXT NOT NULL,
        tags_json TEXT NOT NULL
      );

      CREATE TABLE inline_comments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        correction_id TEXT NOT NULL REFERENCES corrections(id) ON DELETE CASCADE,
        submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL,
        body TEXT NOT NULL,
        anchor_json TEXT NOT NULL,
        tags_json TEXT NOT NULL
      );

      CREATE TABLE attachments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL,
        mime_type TEXT,
        size INTEGER NOT NULL,
        relative_path TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE tags (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );

      CREATE TABLE exam_tags (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
        tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (exam_id, tag_id)
      );

      CREATE INDEX idx_exams_folder_id ON exams(folder_id);
      CREATE INDEX idx_exams_user_id ON exams(user_id);
      CREATE INDEX idx_exam_revisions_exam_id ON exam_revisions(exam_id);
      CREATE INDEX idx_submissions_exam_id ON submissions(exam_id);
      CREATE INDEX idx_corrections_submission_id ON corrections(submission_id);
      CREATE INDEX idx_inline_comments_correction_id ON inline_comments(correction_id);
      CREATE INDEX idx_attachments_exam_id ON attachments(exam_id);
    `)

    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run(
      'schema_version',
      String(DATABASE_SCHEMA_VERSION)
    )
    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('app_version', APP_VERSION)
    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('created_at', createdAt)
  })()
}

function migrateV1ToV2(db: SqliteDatabase): void {
  addUserScopeToLegacySchema(db)
}

function repairMissingUserScope(db: SqliteDatabase): void {
  const hasCompleteUserScope =
    tableExists(db, 'users') &&
    USER_SCOPED_TABLES.every((table) => !tableExists(db, table) || columnExists(db, table, 'user_id'))

  if (hasCompleteUserScope) {
    return
  }

  addUserScopeToLegacySchema(db)
}

function addUserScopeToLegacySchema(db: SqliteDatabase): void {
  const migratedAt = nowIso()
  const userId = crypto.randomUUID()

  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        kind TEXT NOT NULL,
        remote_user_id TEXT,
        onboarding_completed_at TEXT,
        tour_completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `)
    db.prepare(
      `
      INSERT OR IGNORE INTO users
        (id, display_name, kind, remote_user_id, onboarding_completed_at, tour_completed_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(userId, 'Lokaler Nutzer', 'local', null, null, null, migratedAt, migratedAt)

    for (const table of USER_SCOPED_TABLES) {
      if (tableExists(db, table) && !columnExists(db, table, 'user_id')) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN user_id TEXT`)
        db.prepare(`UPDATE ${table} SET user_id = ? WHERE user_id IS NULL`).run(userId)
      }
    }

    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('current_user_id', userId)
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(
      'schema_version',
      String(DATABASE_SCHEMA_VERSION)
    )
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('app_version', APP_VERSION)
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('last_migrated_at', migratedAt)
  })()
}

const USER_SCOPED_TABLES = [
  'folders',
  'exams',
  'exam_revisions',
  'submissions',
  'corrections',
  'inline_comments',
  'attachments',
  'tags',
  'exam_tags'
]

function tableExists(db: SqliteDatabase, table: string): boolean {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table))
}

function columnExists(db: SqliteDatabase, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  return rows.some((row) => row.name === column)
}
