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
  const targetSchemaVersion: number = DATABASE_SCHEMA_VERSION

  if (version === 1 && DATABASE_SCHEMA_VERSION >= 3) {
    migrateV1ToV2(db)
    migrateV2ToV3(db)
    if (DATABASE_SCHEMA_VERSION >= 4) migrateV3ToV4(db)
    if (DATABASE_SCHEMA_VERSION >= 5) migrateV4ToV5(db)
    return
  }

  if (version === 2 && DATABASE_SCHEMA_VERSION >= 3) {
    migrateV2ToV3(db)
    if (DATABASE_SCHEMA_VERSION >= 4) migrateV3ToV4(db)
    if (DATABASE_SCHEMA_VERSION >= 5) migrateV4ToV5(db)
    return
  }

  if (version === 3 && DATABASE_SCHEMA_VERSION >= 4) {
    migrateV3ToV4(db)
    if (DATABASE_SCHEMA_VERSION >= 5) migrateV4ToV5(db)
    return
  }

  if (version === 4 && DATABASE_SCHEMA_VERSION >= 5) {
    migrateV4ToV5(db)
    return
  }

  if (version === targetSchemaVersion) {
    repairMissingUserScope(db)
    repairMissingV3Schema(db)
    repairMissingV4Schema(db)
    repairMissingV5Schema(db)
    updateAppVersion(db)
    return
  }

  if (version !== targetSchemaVersion) {
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
        first_name TEXT,
        last_name TEXT,
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
        legal_area TEXT,
        exam_type TEXT,
        source_name TEXT,
        source_url TEXT,
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
        role TEXT NOT NULL DEFAULT 'other',
        created_at TEXT NOT NULL
      );

      CREATE TABLE ai_correction_drafts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
        correction_id TEXT REFERENCES corrections(id) ON DELETE SET NULL,
        status TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        prompt_version TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        score_points REAL,
        score_reasoning TEXT NOT NULL,
        grading_comment TEXT NOT NULL,
        strengths_json TEXT NOT NULL,
        weaknesses_json TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        confidence TEXT NOT NULL,
        improvement_suggestions_json TEXT NOT NULL,
        inline_comments_json TEXT NOT NULL
      );

      CREATE TABLE learning_tasks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
        correction_id TEXT REFERENCES corrections(id) ON DELETE SET NULL,
        ai_draft_id TEXT REFERENCES ai_correction_drafts(id) ON DELETE SET NULL,
        category TEXT NOT NULL,
        priority TEXT NOT NULL,
        status TEXT NOT NULL,
        title TEXT NOT NULL,
        detail TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE ai_settings (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        api_key TEXT NOT NULL,
        model TEXT NOT NULL,
        updated_at TEXT NOT NULL
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
      CREATE INDEX idx_ai_correction_drafts_submission_id ON ai_correction_drafts(submission_id);
      CREATE INDEX idx_learning_tasks_user_id ON learning_tasks(user_id);
    `)

    createLearningSchema(db)

    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run(
      'schema_version',
      String(DATABASE_SCHEMA_VERSION)
    )
    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('app_version', APP_VERSION)
    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('created_at', createdAt)
  })()
}

function migrateV1ToV2(db: SqliteDatabase): void {
  addUserScopeToLegacySchema(db, 2)
}

function migrateV2ToV3(db: SqliteDatabase): void {
  const migratedAt = nowIso()
  db.transaction(() => {
    addUserProfileColumns(db)
    addColumnIfMissing(db, 'exams', 'legal_area TEXT')
    addColumnIfMissing(db, 'exams', 'exam_type TEXT')
    addColumnIfMissing(db, 'exams', 'source_name TEXT')
    addColumnIfMissing(db, 'exams', 'source_url TEXT')
    addColumnIfMissing(db, 'attachments', "role TEXT NOT NULL DEFAULT 'other'")
    db.exec(`
      CREATE TABLE IF NOT EXISTS ai_correction_drafts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
        correction_id TEXT REFERENCES corrections(id) ON DELETE SET NULL,
        status TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        prompt_version TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        score_points REAL,
        score_reasoning TEXT NOT NULL,
        grading_comment TEXT NOT NULL,
        strengths_json TEXT NOT NULL,
        weaknesses_json TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        confidence TEXT NOT NULL,
        improvement_suggestions_json TEXT NOT NULL,
        inline_comments_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS learning_tasks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
        correction_id TEXT REFERENCES corrections(id) ON DELETE SET NULL,
        ai_draft_id TEXT REFERENCES ai_correction_drafts(id) ON DELETE SET NULL,
        category TEXT NOT NULL,
        priority TEXT NOT NULL,
        status TEXT NOT NULL,
        title TEXT NOT NULL,
        detail TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ai_settings (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        api_key TEXT NOT NULL,
        model TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ai_correction_drafts_submission_id ON ai_correction_drafts(submission_id);
      CREATE INDEX IF NOT EXISTS idx_learning_tasks_user_id ON learning_tasks(user_id);
    `)
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('schema_version', '3')
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('last_migrated_at', migratedAt)
    updateAppVersion(db)
  })()
}

function migrateV3ToV4(db: SqliteDatabase): void {
  const migratedAt = nowIso()
  db.transaction(() => {
    addUserProfileColumns(db)
    createLearningSchema(db)
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('schema_version', '4')
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('last_migrated_at', migratedAt)
    updateAppVersion(db)
  })()
}

function migrateV4ToV5(db: SqliteDatabase): void {
  const migratedAt = nowIso()
  db.transaction(() => {
    createLearningSchema(db)
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('schema_version', '5')
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('last_migrated_at', migratedAt)
    updateAppVersion(db)
  })()
}

function createLearningSchema(db: SqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS learning_collections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      subject TEXT,
      source TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, name)
    );

    CREATE TABLE IF NOT EXISTS learning_cards (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      collection_id TEXT NOT NULL REFERENCES learning_collections(id) ON DELETE CASCADE,
      external_id TEXT,
      title TEXT NOT NULL,
      front_markdown TEXT NOT NULL,
      back_markdown TEXT NOT NULL,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, collection_id, external_id)
    );

    CREATE TABLE IF NOT EXISTS learning_card_tags (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_id TEXT NOT NULL REFERENCES learning_cards(id) ON DELETE CASCADE,
      tag TEXT NOT NULL,
      PRIMARY KEY(card_id, tag)
    );

    CREATE TABLE IF NOT EXISTS learning_review_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_id TEXT NOT NULL REFERENCES learning_cards(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL,
      reviewed_at TEXT NOT NULL,
      elapsed_ms INTEGER
    );

    CREATE TABLE IF NOT EXISTS learning_card_schedules (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_id TEXT NOT NULL REFERENCES learning_cards(id) ON DELETE CASCADE,
      due_at TEXT NOT NULL,
      reps INTEGER NOT NULL DEFAULT 0,
      lapses INTEGER NOT NULL DEFAULT 0,
      last_rating INTEGER,
      last_reviewed_at TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(user_id, card_id)
    );

    CREATE TABLE IF NOT EXISTS learning_card_quality_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_id TEXT NOT NULL REFERENCES learning_cards(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK(status IN ('good', 'needs_work', 'problematic')),
      reasons_json TEXT NOT NULL DEFAULT '[]',
      note TEXT NOT NULL DEFAULT '',
      rated_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_learning_cards_user_collection ON learning_cards(user_id, collection_id);
    CREATE INDEX IF NOT EXISTS idx_learning_card_tags_user_tag ON learning_card_tags(user_id, tag);
    CREATE INDEX IF NOT EXISTS idx_learning_review_events_user_reviewed ON learning_review_events(user_id, reviewed_at);
    CREATE INDEX IF NOT EXISTS idx_learning_card_schedules_due ON learning_card_schedules(user_id, due_at);
    CREATE INDEX IF NOT EXISTS idx_learning_card_quality_events_latest ON learning_card_quality_events(user_id, card_id, rated_at DESC);
  `)
}

function repairMissingUserScope(db: SqliteDatabase): void {
  const hasCompleteUserScope =
    tableExists(db, 'users') &&
    USER_SCOPED_TABLES.every((table) => !tableExists(db, table) || columnExists(db, table, 'user_id'))

  if (hasCompleteUserScope) {
    return
  }

  addUserScopeToLegacySchema(db, DATABASE_SCHEMA_VERSION)
}

function repairMissingV3Schema(db: SqliteDatabase): void {
  const hasV3Schema =
    columnExists(db, 'exams', 'legal_area') &&
    columnExists(db, 'exams', 'exam_type') &&
    columnExists(db, 'exams', 'source_name') &&
    columnExists(db, 'exams', 'source_url') &&
    columnExists(db, 'attachments', 'role') &&
    tableExists(db, 'ai_correction_drafts') &&
    tableExists(db, 'learning_tasks') &&
    tableExists(db, 'ai_settings')

  if (!hasV3Schema) migrateV2ToV3(db)
}

function repairMissingV4Schema(db: SqliteDatabase): void {
  const hasV4Schema =
    tableExists(db, 'learning_collections') &&
    tableExists(db, 'learning_cards') &&
    tableExists(db, 'learning_card_tags') &&
    tableExists(db, 'learning_review_events') &&
    tableExists(db, 'learning_card_schedules')

  if (!hasV4Schema) migrateV3ToV4(db)
  addUserProfileColumns(db)
}

function repairMissingV5Schema(db: SqliteDatabase): void {
  if (!tableExists(db, 'learning_card_quality_events')) migrateV4ToV5(db)
}

function addUserScopeToLegacySchema(db: SqliteDatabase, targetSchemaVersion: number): void {
  const migratedAt = nowIso()
  const userId = crypto.randomUUID()

  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
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
      String(targetSchemaVersion)
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
  'ai_correction_drafts',
  'learning_tasks',
  'learning_collections',
  'learning_cards',
  'learning_card_tags',
  'learning_review_events',
  'learning_card_schedules',
  'learning_card_quality_events',
  'ai_settings',
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

function addColumnIfMissing(db: SqliteDatabase, table: string, definition: string): void {
  const column = definition.split(/\s+/)[0]
  if (!columnExists(db, table, column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`)
}

function addUserProfileColumns(db: SqliteDatabase): void {
  if (!tableExists(db, 'users')) return
  addColumnIfMissing(db, 'users', 'first_name TEXT')
  addColumnIfMissing(db, 'users', 'last_name TEXT')
}
