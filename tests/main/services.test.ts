import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import Database from 'better-sqlite3'
import JSZip from 'jszip'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { seedDemoDataIfEnabled } from '@main/services/demoData'
import { AppServices } from '@main/services/services'
import {
  APP_VERSION,
  DATABASE_SCHEMA_VERSION,
  DOCUMENT_SCHEMA_VERSION,
  EDITOR_SCHEMA_VERSION,
  JURA_FORMAT,
  JURA_FORMAT_VERSION
} from '@shared/constants'

let dataDir: string
let services: AppServices

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'jura-services-'))
  services = new AppServices(dataDir)
})

afterEach(async () => {
  services?.close()
  await rm(dataDir, { recursive: true, force: true })
})

describe('AppServices', () => {
  it('creates a fresh database with the current schema', () => {
    const row = services.db
      .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
      .get() as { value: string }
    const columns = services.db.prepare("PRAGMA table_info('folders')").all() as Array<{ name: string }>

    expect(Number(row.value)).toBe(DATABASE_SCHEMA_VERSION)
    expect(columns.some((column) => column.name === 'trashed_at')).toBe(true)
    expect(columns.some((column) => column.name === 'user_id')).toBe(true)
  })

  it('repairs legacy databases that already report the current schema without users', async () => {
    services.close()
    await rm(dataDir, { recursive: true, force: true })
    dataDir = await mkdtemp(join(tmpdir(), 'jura-services-legacy-'))

    const db = new Database(join(dataDir, 'database.sqlite'))
    const now = new Date().toISOString()
    const folderId = crypto.randomUUID()
    const examId = crypto.randomUUID()
    db.exec(`
      CREATE TABLE meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        trashed_at TEXT
      );
      CREATE TABLE exams (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        folder_id TEXT,
        status TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        current_revision_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE exam_revisions (
        id TEXT PRIMARY KEY,
        exam_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        kind TEXT NOT NULL,
        content_format TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        content_json TEXT NOT NULL
      );
      CREATE TABLE submissions (
        id TEXT PRIMARY KEY,
        exam_id TEXT NOT NULL,
        submitted_at TEXT NOT NULL,
        revision_id TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        pdf_path TEXT
      );
      CREATE TABLE corrections (
        id TEXT PRIMARY KEY,
        submission_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        score_points INTEGER,
        grading_comment TEXT NOT NULL,
        tags_json TEXT NOT NULL
      );
      CREATE TABLE inline_comments (
        id TEXT PRIMARY KEY,
        correction_id TEXT NOT NULL,
        submission_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL,
        body TEXT NOT NULL,
        anchor_json TEXT NOT NULL,
        tags_json TEXT NOT NULL
      );
      CREATE TABLE attachments (
        id TEXT PRIMARY KEY,
        exam_id TEXT NOT NULL,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL,
        mime_type TEXT,
        size INTEGER NOT NULL,
        relative_path TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );
      CREATE TABLE exam_tags (
        exam_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (exam_id, tag_id)
      );
    `)
    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run(
      'schema_version',
      String(DATABASE_SCHEMA_VERSION)
    )
    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('app_version', '0.1.0')
    db.prepare(
      'INSERT INTO folders (id, name, parent_id, created_at, updated_at, trashed_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(folderId, 'Zivilrecht', null, now, now, null)
    db.prepare(
      `
      INSERT INTO exams
        (id, title, folder_id, status, tags_json, notes, current_revision_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(examId, 'Legacy Klausur', folderId, 'draft', '["zivilrecht"]', '', null, now, now)
    db.close()

    services = new AppServices(dataDir)

    const currentUser = services.getCurrentUser()
    const folderColumns = services.db.prepare("PRAGMA table_info('folders')").all() as Array<{ name: string }>
    const examColumns = services.db.prepare("PRAGMA table_info('exams')").all() as Array<{ name: string }>
    const attachmentColumns = services.db.prepare("PRAGMA table_info('attachments')").all() as Array<{ name: string }>

    expect(currentUser.id).toMatch(UUID_PATTERN)
    expect(folderColumns.some((column) => column.name === 'user_id')).toBe(true)
    expect(examColumns.some((column) => column.name === 'user_id')).toBe(true)
    expect(examColumns.some((column) => column.name === 'legal_area')).toBe(true)
    expect(attachmentColumns.some((column) => column.name === 'role')).toBe(true)
    expect(tableExists(services.db, 'ai_correction_drafts')).toBe(true)
    expect(tableExists(services.db, 'learning_tasks')).toBe(true)
    expect(tableExists(services.db, 'ai_settings')).toBe(true)
    expect(services.listFolders()).toEqual([expect.objectContaining({ id: folderId, userId: currentUser.id })])
    expect(services.listExams()).toEqual([expect.objectContaining({ id: examId, userId: currentUser.id })])
  })

  it('migrates legacy v1 databases to schema 3 with AI tables and metadata columns', async () => {
    services.close()
    await rm(dataDir, { recursive: true, force: true })
    dataDir = await mkdtemp(join(tmpdir(), 'jura-services-v1-'))
    seedLegacyDatabase(dataDir, 1)

    services = new AppServices(dataDir)

    expect(schemaVersion(services.db)).toBe(3)
    expect(columnExists(services.db, 'exams', 'user_id')).toBe(true)
    expect(columnExists(services.db, 'exams', 'legal_area')).toBe(true)
    expect(columnExists(services.db, 'attachments', 'role')).toBe(true)
    expect(tableExists(services.db, 'ai_correction_drafts')).toBe(true)
    expect(tableExists(services.db, 'learning_tasks')).toBe(true)
    expect(tableExists(services.db, 'ai_settings')).toBe(true)
  })

  it('migrates legacy v2 databases to schema 3 with AI tables and metadata columns', async () => {
    services.close()
    await rm(dataDir, { recursive: true, force: true })
    dataDir = await mkdtemp(join(tmpdir(), 'jura-services-v2-'))
    seedLegacyDatabase(dataDir, 2)

    services = new AppServices(dataDir)

    expect(schemaVersion(services.db)).toBe(3)
    expect(columnExists(services.db, 'exams', 'legal_area')).toBe(true)
    expect(columnExists(services.db, 'attachments', 'role')).toBe(true)
    expect(tableExists(services.db, 'ai_correction_drafts')).toBe(true)
    expect(tableExists(services.db, 'learning_tasks')).toBe(true)
    expect(tableExists(services.db, 'ai_settings')).toBe(true)
  })

  it('isolates local data per user and stores onboarding status per user', () => {
    const firstUser = services.getCurrentUser()
    expect(firstUser.id).toMatch(UUID_PATTERN)

    const firstExam = services.createExam({ title: 'Nutzer A Klausur' })
    const completed = services.completeOnboarding(firstUser.id)
    expect(completed.onboardingCompletedAt).not.toBeNull()

    const secondUser = services.createUser('Nutzer B')
    expect(secondUser.id).toMatch(UUID_PATTERN)
    expect(secondUser.id).not.toBe(firstUser.id)
    expect(services.listExams()).toEqual([])

    const secondExam = services.createExam({ title: 'Nutzer B Klausur' })
    expect(secondExam.userId).toBe(secondUser.id)
    expect(services.completeTour(secondUser.id).tourCompletedAt).not.toBeNull()

    services.switchUser(firstUser.id)
    expect(services.listExams()).toEqual([expect.objectContaining({ id: firstExam.id, userId: firstUser.id })])
    expect(services.getCurrentUser().onboardingCompletedAt).not.toBeNull()

    services.switchUser(secondUser.id)
    expect(services.listExams()).toEqual([expect.objectContaining({ id: secondExam.id, userId: secondUser.id })])
  })

  it('renames the current user without changing their workspace', () => {
    const user = services.getCurrentUser()
    const exam = services.createExam({ title: 'Nutzername Klausur' })

    const renamed = services.updateUser({ id: user.id, displayName: 'Sebastian' })

    expect(renamed.id).toBe(user.id)
    expect(renamed.displayName).toBe('Sebastian')
    expect(services.getCurrentUser().displayName).toBe('Sebastian')
    expect(services.listExams()).toEqual([expect.objectContaining({ id: exam.id, userId: user.id })])
    expect(services.updateUser({ id: user.id, displayName: ' ' }).displayName).toBe('Lokaler Nutzer')
  })

  it('creates, moves, tags, submits and corrects an exam', async () => {
    const folder = services.createFolder('Zivilrecht')
    const exam = services.createExam({
      title: 'Schuldrecht AT',
      folderId: folder.id,
      tags: ['zivilrecht', 'übung']
    })

    services.saveRevision(exam.id, {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Anspruch entstanden.' }] }]
    })

    const submitted = services.submitExam(exam.id)
    const details = services.getSubmission(submitted.id)
    const correction = services.createCorrection(submitted.id)
    const updated = services.updateCorrection({
      correctionId: correction.id,
      scorePoints: 9.5,
      gradingComment: 'Solide, Schwerpunkt knapper.',
      tags: ['wiederholen']
    })

    const comment = services.addInlineComment({
      correctionId: updated.id,
      submissionId: submitted.id,
      body: 'Definition genauer.',
      tags: [],
      anchor: {
        type: 'prosemirror-selection',
        editorSchemaVersion: EDITOR_SCHEMA_VERSION,
        from: 0,
        to: 8,
        selectedText: 'Anspruch',
        prefix: '',
        suffix: ' entstanden.',
        contentHash: details.contentHash
      }
    })

    const correctedExam = services.getExam(exam.id)
    expect(correctedExam.status).toBe('corrected')
    expect(correctedExam.latestScore).toBe(9.5)
    expect(services.getSubmission(submitted.id).corrections[0].inlineComments[0].id).toBe(comment.id)
  })

  it('uses UUIDs for persisted domain entities', async () => {
    const folder = services.createFolder('UUID Ordner')
    const exam = services.createExam({ title: 'UUID Klausur', folderId: folder.id })
    const revision = services.saveRevision(exam.id, {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'UUID Text.' }] }]
    })
    const sourcePath = join(dataDir, 'uuid-anlage.txt')
    await writeFile(sourcePath, 'Anlage')
    const attachment = await services.addAttachmentFromPath(exam.id, sourcePath)
    const submission = services.submitExam(exam.id)
    const correction = services.createCorrection(submission.id)
    const comment = services.addInlineComment({
      correctionId: correction.id,
      submissionId: submission.id,
      body: 'UUID Kommentar',
      tags: [],
      anchor: {
        type: 'prosemirror-selection',
        editorSchemaVersion: EDITOR_SCHEMA_VERSION,
        from: 0,
        to: 4,
        selectedText: 'UUID',
        prefix: '',
        suffix: ' Text.',
        contentHash: revision.contentHash
      }
    })

    for (const id of [
      folder.id,
      exam.id,
      revision.id,
      attachment.id,
      submission.id,
      correction.id,
      comment.id
    ]) {
      expect(id).toMatch(UUID_PATTERN)
    }
  })

  it('loads local demo exams from markdown for development screenshots', () => {
    const previousDemoSetting = process.env.JURA_DEMO_DATA
    delete process.env.JURA_DEMO_DATA

    try {
      seedDemoDataIfEnabled(services)

      const exams = services.listExams()
      const analytics = services.listAnalyticsEntries()

      expect(exams).toHaveLength(20)
      expect(analytics).toHaveLength(20)
      expect(services.getCurrentUser().kind).toBe('demo')
      expect(analytics[0].scorePoints).toBe(4.5)
      expect(analytics.at(-1)?.scorePoints).toBe(9)
      expect(exams.every((exam) => exam.status === 'corrected')).toBe(true)
      expect(exams.some((exam) => exam.tags.includes('2-examen'))).toBe(true)
      expect(exams.every((exam) => exam.legalArea === 'civil')).toBe(true)
      expect(exams.every((exam) => exam.examType === 'judgment')).toBe(true)
      expect(exams.every((exam) => exam.sourceName === 'Demo')).toBe(true)
      expect(exams.every((exam) => exam.sourceUrl === null)).toBe(true)
    } finally {
      if (previousDemoSetting === undefined) {
        delete process.env.JURA_DEMO_DATA
      } else {
        process.env.JURA_DEMO_DATA = previousDemoSetting
      }
    }
  })

  it('copies attachments into the app storage', async () => {
    const exam = services.createExam({ title: 'Mit Sachverhalt' })
    const sourcePath = join(dataDir, 'sachverhalt.txt')
    await writeFile(sourcePath, 'Sachverhalt')

    const attachment = await services.addAttachmentFromPath(exam.id, sourcePath)
    const storedPath = services.getAttachmentPath(attachment.id)

    expect(storedPath).not.toBe(sourcePath)
    expect(storedPath).toContain(join('files', 'exams', exam.id, 'attachments'))
  })

  it('stores exam metadata and attachment roles', async () => {
    const exam = services.createExam({
      title: 'ZR Urteil',
      legalArea: 'civil',
      examType: 'judgment',
      sourceName: 'Hemmer',
      sourceUrl: 'https://example.test/klausur'
    })

    expect(exam.legalArea).toBe('civil')
    expect(exam.examType).toBe('judgment')
    expect(exam.sourceName).toBe('Hemmer')

    const sourcePath = join(dataDir, 'musterloesung.pdf')
    await writeFile(sourcePath, 'Musterloesung')
    const attachment = await services.addAttachmentFromPath(exam.id, sourcePath, 'model_solution')

    expect(attachment.role).toBe('model_solution')
    expect(services.getExam(exam.id).attachments[0].role).toBe('model_solution')
  })

  it('rejects invalid exam metadata without persisting a bad exam row', () => {
    expect(() =>
      services.createExam({
        title: 'Ungueltige Metadaten',
        legalArea: 'invalid' as never
      })
    ).toThrow()

    const row = services.db.prepare('SELECT COUNT(*) AS count FROM exams').get() as { count: number }
    expect(row.count).toBe(0)
  })

  it('rejects invalid exam status updates without changing the existing row', () => {
    const exam = services.createExam({ title: 'Status Klausur' })

    expect(() => services.updateExam({ id: exam.id, status: 'invalid' } as never)).toThrow()

    const row = services.db.prepare('SELECT title, status FROM exams WHERE id = ?').get(exam.id) as {
      title: string
      status: string
    }
    expect(row).toEqual({
      title: 'Status Klausur',
      status: 'draft'
    })
  })

  it('rejects invalid attachment roles before copying or inserting', async () => {
    const exam = services.createExam({ title: 'Anlagenrolle' })
    const sourcePath = join(dataDir, 'anlage.pdf')
    await writeFile(sourcePath, 'Anlage')

    await expect(
      services.addAttachmentFromPath(exam.id, sourcePath, 'invalid' as never)
    ).rejects.toThrow()

    const row = services.db.prepare('SELECT COUNT(*) AS count FROM attachments').get() as { count: number }
    expect(row.count).toBe(0)
    await expect(stat(join(dataDir, 'files'))).rejects.toThrow()
  })

  it('stores AI drafts and accepts them into the existing correction structure', () => {
    const exam = services.createExam({ title: 'KI Klausur', legalArea: 'civil', examType: 'judgment' })
    services.saveRevision(exam.id, {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Anspruch entstanden.' }] }]
    })
    const submission = services.submitExam(exam.id)
    const existingCorrection = services.createCorrection(submission.id)
    const manualComment = services.addInlineComment({
      correctionId: existingCorrection.id,
      submissionId: submission.id,
      body: 'Manueller Kommentar bleibt erhalten.',
      tags: [],
      anchor: {
        type: 'prosemirror-selection',
        editorSchemaVersion: EDITOR_SCHEMA_VERSION,
        from: 0,
        to: 8,
        selectedText: 'Anspruch',
        prefix: '',
        suffix: ' entstanden.',
        contentHash: submission.contentHash
      }
    })
    const draft = services.saveAiCorrectionDraft({
      submissionId: submission.id,
      provider: 'openai',
      model: 'gpt-5',
      scorePoints: 7.5,
      scoreReasoning: 'Basis erkannt, Schwerpunkt fehlt.',
      gradingComment: 'Ordentliche Grundlage.',
      strengths: ['Anspruchsaufbau vorhanden'],
      weaknesses: ['Schwerpunktsetzung fehlt'],
      tags: ['schwerpunktsetzung'],
      confidence: 'medium',
      improvementSuggestions: [
        {
          category: 'structure',
          priority: 'high',
          title: 'Schwerpunkt setzen',
          detail: 'Beginne mit der zentralen Anspruchsgrundlage.'
        }
      ],
      inlineComments: [
        {
          selectedText: 'entstanden',
          prefix: 'Anspruch ',
          suffix: '.',
          body: 'Hier genauer am Sachverhalt prüfen.',
          tags: ['sachverhalt']
        },
        {
          selectedText: 'Halluzination',
          prefix: '',
          suffix: '',
          body: 'Dieser Kommentar darf nicht falsch verankert werden.',
          tags: ['ki']
        }
      ]
    })

    const accepted = services.acceptAiCorrectionDraft(draft.id)
    const details = services.getSubmission(submission.id)
    const tasks = services.listLearningTasks()

    expect(accepted.status).toBe('accepted')
    expect(details.corrections[0].score.points).toBe(7.5)
    expect(details.corrections[0].gradingComment).toContain('Ordentliche Grundlage')
    expect(details.corrections[0].tags).toEqual(['schwerpunktsetzung'])
    expect(details.corrections[0].inlineComments).toEqual([
      expect.objectContaining({
        id: manualComment.id,
        body: 'Manueller Kommentar bleibt erhalten.'
      }),
      expect.objectContaining({
        targetSubmissionId: submission.id,
        correctionId: existingCorrection.id,
        userId: draft.userId,
        status: 'open',
        body: 'Hier genauer am Sachverhalt prüfen.',
        tags: ['sachverhalt'],
        anchor: expect.objectContaining({
          type: 'prosemirror-selection',
          editorSchemaVersion: EDITOR_SCHEMA_VERSION,
          selectedText: 'entstanden',
          prefix: 'Anspruch ',
          suffix: '.',
          contentHash: submission.contentHash
        })
      })
    ])
    expect(
      details.corrections[0].inlineComments.some(
        (comment) => comment.body === 'Dieser Kommentar darf nicht falsch verankert werden.'
      )
    ).toBe(false)
    expect(tasks).toEqual([
      expect.objectContaining({
        submissionId: submission.id,
        category: 'structure',
        priority: 'high',
        status: 'open'
      })
    ])
  })

  it('rejects accepting or rejecting non-draft AI correction drafts', () => {
    const exam = services.createExam({ title: 'KI Status' })
    services.saveRevision(exam.id, {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Anspruch entstanden.' }] }]
    })
    const submission = services.submitExam(exam.id)
    const draft = services.saveAiCorrectionDraft({
      submissionId: submission.id,
      provider: 'openai',
      model: 'gpt-5',
      scorePoints: 7.5,
      scoreReasoning: 'Basis erkannt.',
      gradingComment: 'Ordentliche Grundlage.',
      strengths: [],
      weaknesses: [],
      tags: [],
      confidence: 'medium',
      improvementSuggestions: [
        {
          category: 'structure',
          priority: 'high',
          title: 'Schwerpunkt setzen',
          detail: 'Beginne mit der zentralen Anspruchsgrundlage.'
        }
      ],
      inlineComments: []
    })

    services.acceptAiCorrectionDraft(draft.id)

    expect(() => services.acceptAiCorrectionDraft(draft.id)).toThrow(/draft/i)
    expect(() => services.rejectAiCorrectionDraft(draft.id)).toThrow(/draft/i)
    expect(services.listLearningTasks()).toHaveLength(1)
  })

  it('updates a learning task status after accepting an AI correction draft', () => {
    const exam = services.createExam({ title: 'KI Lernaufgabe' })
    services.saveRevision(exam.id, {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Anspruch entstanden.' }] }]
    })
    const submission = services.submitExam(exam.id)
    const draft = services.saveAiCorrectionDraft({
      submissionId: submission.id,
      provider: 'openai',
      model: 'gpt-5',
      scorePoints: 7.5,
      scoreReasoning: 'Basis erkannt.',
      gradingComment: 'Ordentliche Grundlage.',
      strengths: [],
      weaknesses: [],
      tags: [],
      confidence: 'medium',
      improvementSuggestions: [
        {
          category: 'structure',
          priority: 'high',
          title: 'Schwerpunkt setzen',
          detail: 'Beginne mit der zentralen Anspruchsgrundlage.'
        }
      ],
      inlineComments: []
    })

    services.acceptAiCorrectionDraft(draft.id)
    const task = services.listLearningTasks()[0]
    const updated = services.updateLearningTaskStatus(task.id, 'done')

    expect(updated.status).toBe('done')
    expect(services.listLearningTasks()[0].status).toBe('done')
  })

  it('rolls back AI draft acceptance if learning task persistence fails', () => {
    const exam = services.createExam({ title: 'KI Rollback' })
    services.saveRevision(exam.id, {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Anspruch entstanden.' }] }]
    })
    const submission = services.submitExam(exam.id)
    const supersededCandidate = services.saveAiCorrectionDraft({
      submissionId: submission.id,
      provider: 'openai',
      model: 'gpt-5',
      scorePoints: 5,
      scoreReasoning: 'Andere Bewertung.',
      gradingComment: 'Anderer Entwurf.',
      strengths: [],
      weaknesses: [],
      tags: ['alt'],
      confidence: 'low',
      improvementSuggestions: [],
      inlineComments: []
    })
    const draft = services.saveAiCorrectionDraft({
      submissionId: submission.id,
      provider: 'openai',
      model: 'gpt-5',
      scorePoints: 8,
      scoreReasoning: 'Basis erkannt.',
      gradingComment: 'Solide Grundlage.',
      strengths: [],
      weaknesses: [],
      tags: ['neu'],
      confidence: 'medium',
      improvementSuggestions: [
        {
          category: 'structure',
          priority: 'high',
          title: 'Schwerpunkt setzen',
          detail: 'Beginne mit der zentralen Anspruchsgrundlage.'
        }
      ],
      inlineComments: []
    })

    services.db.exec(`
      CREATE TRIGGER fail_learning_task_insert
      BEFORE INSERT ON learning_tasks
      BEGIN
        SELECT RAISE(ABORT, 'learning task insert failed');
      END;
    `)

    expect(() => services.acceptAiCorrectionDraft(draft.id)).toThrow(/learning task insert failed/)

    const details = services.getSubmission(submission.id)
    const drafts = services.listAiCorrectionDrafts(submission.id)

    expect(details.corrections).toEqual([])
    expect(services.getExam(exam.id).status).toBe('submitted')
    expect(services.listLearningTasks()).toEqual([])
    expect(drafts.find((candidate) => candidate.id === draft.id)?.status).toBe('draft')
    expect(drafts.find((candidate) => candidate.id === supersededCandidate.id)?.status).toBe('draft')
  })

  it('persists AI settings for the current user', () => {
    expect(services.getAiSettingsStatus()).toEqual({
      provider: 'openai',
      configured: false,
      model: null,
      source: null,
      keyPreview: null,
      updatedAt: null
    })

    const saved = services.saveAiSettings({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-5'
    })

    expect(saved.configured).toBe(true)
    expect(saved.model).toBe('gpt-5')
    expect(saved.source).toBe('stored')
    expect(saved.keyPreview).toBe('...test')
    expect(saved.updatedAt).not.toBeNull()

    services.close()
    services = new AppServices(dataDir)

    expect(services.getAiSettingsStatus()).toEqual(saved)
  })

  it('keeps the stored OpenAI key when saving AI settings with an empty key field', () => {
    services.saveAiSettings({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-5.5'
    })

    const updated = services.saveAiSettings({
      provider: 'openai',
      apiKey: ' ',
      model: 'gpt-5.5'
    })

    expect(updated.configured).toBe(true)
    expect(updated.model).toBe('gpt-5.5')
    expect(updated.updatedAt).not.toBeNull()
  })

  it('uses a development OpenAI key from the environment without persisting it', () => {
    const previousOpenApiKey = process.env.OPEN_API_KEY
    const previousOpenAiApiKey = process.env.OPENAI_API_KEY
    const previousOpenAiModel = process.env.OPENAI_MODEL
    delete process.env.OPENAI_API_KEY
    delete process.env.OPENAI_MODEL
    process.env.OPEN_API_KEY = 'sk-env-test'

    try {
      expect(services.getAiSettingsStatus()).toEqual({
        provider: 'openai',
        configured: true,
        model: 'gpt-5.5',
        source: 'environment',
        keyPreview: '...test',
        updatedAt: null
      })

      services.close()
      services = new AppServices(dataDir)

      expect(services.getAiSettingsStatus()).toEqual({
        provider: 'openai',
        configured: true,
        model: 'gpt-5.5',
        source: 'environment',
        keyPreview: '...test',
        updatedAt: null
      })
    } finally {
      if (previousOpenApiKey === undefined) delete process.env.OPEN_API_KEY
      else process.env.OPEN_API_KEY = previousOpenApiKey
      if (previousOpenAiApiKey === undefined) delete process.env.OPENAI_API_KEY
      else process.env.OPENAI_API_KEY = previousOpenAiApiKey
      if (previousOpenAiModel === undefined) delete process.env.OPENAI_MODEL
      else process.env.OPENAI_MODEL = previousOpenAiModel
    }
  })

  it('rejects empty AI settings credentials', () => {
    expect(() =>
      services.saveAiSettings({
        provider: 'openai',
        apiKey: ' ',
        model: 'gpt-5'
      })
    ).toThrow(/API key/i)

    expect(() =>
      services.saveAiSettings({
        provider: 'openai',
        apiKey: 'sk-test',
        model: ' '
      })
    ).toThrow(/model/i)

    expect(services.getAiSettingsStatus().configured).toBe(false)
  })

  it('removes stored AI settings for the current user', () => {
    services.saveAiSettings({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-5.5'
    })

    const status = services.removeAiSettings()

    expect(status).toEqual({
      provider: 'openai',
      configured: false,
      model: null,
      source: null,
      keyPreview: null,
      updatedAt: null
    })
  })

  it('tests the configured AI connection without exposing credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ output_text: 'OK' })
      })
    )
    services.saveAiSettings({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-5.5'
    })

    await expect(services.testAiConnection()).resolves.toEqual({
      ok: true,
      model: 'gpt-5.5',
      message: 'Verbindung erfolgreich.'
    })
  })

  it('returns a user-facing AI connection error instead of throwing raw OpenAI failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue('invalid api key')
      })
    )
    services.saveAiSettings({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-5.5'
    })

    await expect(services.testAiConnection()).resolves.toEqual({
      ok: false,
      model: 'gpt-5.5',
      message: 'Verbindung fehlgeschlagen. Bitte Key und Modell prüfen.'
    })
  })

  it('rejects unsupported AI settings providers at runtime', () => {
    expect(() =>
      services.saveAiSettings({
        provider: 'anthropic',
        apiKey: 'sk-test',
        model: 'claude-sonnet'
      } as unknown as Parameters<AppServices['saveAiSettings']>[0])
    ).toThrow(/provider/i)

    expect(services.getAiSettingsStatus().configured).toBe(false)
  })

  it('exports and imports .jura packages with exam metadata, attachment roles and accepted corrections only', async () => {
    const exam = services.createExam({
      title: 'Exportklausur',
      tags: ['strafrecht'],
      legalArea: 'criminal',
      examType: 'expert_opinion',
      sourceName: 'Demo',
      sourceUrl: 'https://example.test/klausur'
    })
    services.saveRevision(exam.id, {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tatbestand.' }] }]
    })
    const sourcePath = join(dataDir, 'anlage.txt')
    await writeFile(sourcePath, 'Anlage')
    const attachment = await services.addAttachmentFromPath(exam.id, sourcePath, 'model_solution')
    const submission = services.submitExam(exam.id)
    services.saveAiSettings({
      provider: 'openai',
      apiKey: 'sk-test-secret',
      model: 'gpt-5'
    })
    const draft = services.saveAiCorrectionDraft({
      submissionId: submission.id,
      provider: 'openai',
      model: 'gpt-5',
      scorePoints: 14.5,
      scoreReasoning: 'Tatbestand tragfähig.',
      gradingComment: 'Gut.',
      strengths: ['Klare Struktur'],
      weaknesses: ['Kurz'],
      tags: ['ki-vorschlag'],
      confidence: 'medium',
      improvementSuggestions: [
        {
          category: 'structure',
          priority: 'medium',
          title: 'Schwerpunkte markieren',
          detail: 'Gliedere die tragenden Punkte noch sichtbarer.'
        }
      ],
      inlineComments: []
    })
    services.acceptAiCorrectionDraft(draft.id)

    const packagePath = join(dataDir, 'export.jura')
    await services.exportExamPackage(exam.id, packagePath)
    const zip = await JSZip.loadAsync(await readFile(packagePath))
    const document = JSON.parse(await zip.file('document.json')!.async('string')) as Record<string, unknown>
    const attachmentDocument = JSON.parse(
      await zip.file(`attachments/${attachment.id}/attachment.json`)!.async('string')
    ) as Record<string, unknown>
    const packageFileNames = Object.keys(zip.files)

    expect(document).toEqual(
      expect.objectContaining({
        legalArea: 'criminal',
        examType: 'expert_opinion',
        sourceName: 'Demo',
        sourceUrl: 'https://example.test/klausur'
      })
    )
    expect(attachmentDocument.role).toBe('model_solution')
    expect(packageFileNames.some((file) => file.includes('ai_') || file.includes('learning'))).toBe(false)
    const packageText = (
      await Promise.all(packageFileNames.map((file) => zip.file(file)?.async('string') ?? Promise.resolve('')))
    ).join('\n')
    expect(packageText).not.toContain('sk-test-secret')

    const importedDir = await mkdtemp(join(tmpdir(), 'jura-import-'))
    const importedServices = new AppServices(importedDir)
    try {
      const imported = await importedServices.importExamPackage(packagePath)
      expect(imported.title).toBe('Exportklausur')
      expect(imported.tags).toEqual(['strafrecht'])
      expect(imported.legalArea).toBe('criminal')
      expect(imported.examType).toBe('expert_opinion')
      expect(imported.sourceName).toBe('Demo')
      expect(imported.sourceUrl).toBe('https://example.test/klausur')
      expect(imported.attachments).toHaveLength(1)
      expect(imported.attachments[0].role).toBe('model_solution')
      expect(imported.submissions).toHaveLength(1)
      expect(importedServices.getSubmission(imported.submissions[0].id).corrections[0].score.points).toBe(14.5)
      expect(importedServices.listAiCorrectionDrafts(imported.submissions[0].id)).toEqual([])
      expect(importedServices.getAiSettingsStatus().configured).toBe(false)
      expect(importedServices.listLearningTasks()).toEqual([])
    } finally {
      importedServices.close()
      await rm(importedDir, { recursive: true, force: true })
    }
  })

  it('rejects inconsistent .jura packages without partially importing an exam', async () => {
    const now = new Date().toISOString()
    const examId = crypto.randomUUID()
    const submissionId = crypto.randomUUID()
    const missingRevisionId = crypto.randomUUID()
    const packagePath = join(dataDir, 'broken.jura')
    const zip = new JSZip()

    zip.file(
      'manifest.json',
      JSON.stringify({
        format: JURA_FORMAT,
        formatVersion: JURA_FORMAT_VERSION,
        minimumAppVersion: APP_VERSION,
        createdWithAppVersion: APP_VERSION,
        documentSchemaVersion: DOCUMENT_SCHEMA_VERSION,
        createdAt: now,
        documentId: examId
      })
    )
    zip.file(
      'document.json',
      JSON.stringify({
        schemaVersion: DOCUMENT_SCHEMA_VERSION,
        documentType: 'jura-klausur',
        id: examId,
        title: 'Defekter Import',
        status: 'submitted',
        folderPath: [],
        tags: [],
        notes: '',
        createdAt: now,
        updatedAt: now,
        currentRevisionId: null,
        submissions: [submissionId],
        corrections: [],
        attachments: []
      })
    )
    zip.file(
      `submissions/${submissionId}/submission.json`,
      JSON.stringify({
        schemaVersion: 1,
        id: submissionId,
        examId,
        submittedAt: now,
        revisionId: missingRevisionId,
        contentHash: 'missing-revision',
        canContinueEditing: true,
        pdfPath: null
      })
    )
    await writeFile(packagePath, await zip.generateAsync({ type: 'nodebuffer' }))

    await expect(services.importExamPackage(packagePath)).rejects.toThrow(
      /missing submission revision/
    )
    expect(() => services.getExam(examId)).toThrow(`Exam not found: ${examId}`)
    expect(services.listExams()).toEqual([])
  })

  it('renames, trashes and restores folders without deleting data', async () => {
    const sourceFolder = services.createFolder('Quelle')
    const targetFolder = services.createFolder('Ziel')
    const exam = services.createExam({ title: 'Klausur A', folderId: sourceFolder.id })

    const renamed = services.updateFolder({ id: sourceFolder.id, name: 'Quelle Neu' })
    expect(renamed.name).toBe('Quelle Neu')
    expect(renamed.trashedAt).toBeNull()

    const trashed = services.trashFolder({ id: sourceFolder.id, moveExamsToFolderId: targetFolder.id })
    expect(trashed.trashedAt).not.toBeNull()
    expect(services.getExam(exam.id).folderId).toBe(targetFolder.id)

    const restored = services.restoreFolder(sourceFolder.id)
    expect(restored.trashedAt).toBeNull()
    expect(services.listFolders().find((folder) => folder.id === sourceFolder.id)?.name).toBe('Quelle Neu')
  })

  it('moves exams to the trash and restores them without deleting data', () => {
    const exam = services.createExam({ title: 'Löschtest' })
    services.saveRevision(exam.id, {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bleibt erhalten.' }] }]
    })

    const trashed = services.trashExam(exam.id)
    expect(trashed.status).toBe('archived')
    expect(trashed.currentRevision?.content).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bleibt erhalten.' }] }]
    })

    const restored = services.restoreExam(exam.id)
    expect(restored.status).toBe('in_progress')
    expect(restored.currentRevision?.content).toEqual(trashed.currentRevision?.content)
  })

  it('lists analytics entries with score, dates and tags', () => {
    const exam = services.createExam({ title: 'Auswertung', tags: ['bayern', 'probe'] })
    services.saveRevision(exam.id, {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ausarbeitung.' }] }]
    })

    const submission = services.submitExam(exam.id)
    const correction = services.createCorrection(submission.id)
    services.updateCorrection({
      correctionId: correction.id,
      scorePoints: 12.5,
      gradingComment: 'Gut strukturiert.',
      tags: ['klausurtaktik']
    })

    expect(services.listAnalyticsEntries()).toEqual([
      expect.objectContaining({
        examId: exam.id,
        examTitle: 'Auswertung',
        submissionId: submission.id,
        scorePoints: 12.5,
        examTags: ['bayern', 'probe'],
        correctionTags: ['klausurtaktik']
      })
    ])
  })
})

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function schemaVersion(db: Database.Database): number {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as { value: string }
  return Number(row.value)
}

function tableExists(db: Database.Database, table: string): boolean {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table))
}

function columnExists(db: Database.Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  return rows.some((row) => row.name === column)
}

function seedLegacyDatabase(targetDataDir: string, version: 1 | 2): void {
  const db = new Database(join(targetDataDir, 'database.sqlite'))
  const now = new Date().toISOString()
  const userId = crypto.randomUUID()
  const userColumn = version === 2 ? 'user_id TEXT NOT NULL,' : ''
  const userReference = version === 2 ? 'user_id,' : ''
  const userValue = version === 2 ? `'${userId}',` : ''

  db.exec(`
    CREATE TABLE meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    ${
      version === 2
        ? `CREATE TABLE users (
            id TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            kind TEXT NOT NULL,
            remote_user_id TEXT,
            onboarding_completed_at TEXT,
            tour_completed_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );`
        : ''
    }
    CREATE TABLE folders (
      id TEXT PRIMARY KEY,
      ${userColumn}
      name TEXT NOT NULL,
      parent_id TEXT,
      trashed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE exams (
      id TEXT PRIMARY KEY,
      ${userColumn}
      title TEXT NOT NULL,
      folder_id TEXT,
      status TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      current_revision_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE exam_revisions (
      id TEXT PRIMARY KEY,
      ${userColumn}
      exam_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      kind TEXT NOT NULL,
      content_format TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      content_json TEXT NOT NULL
    );
    CREATE TABLE submissions (
      id TEXT PRIMARY KEY,
      ${userColumn}
      exam_id TEXT NOT NULL,
      submitted_at TEXT NOT NULL,
      revision_id TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      pdf_path TEXT
    );
    CREATE TABLE corrections (
      id TEXT PRIMARY KEY,
      ${userColumn}
      submission_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      score_points INTEGER,
      grading_comment TEXT NOT NULL,
      tags_json TEXT NOT NULL
    );
    CREATE TABLE inline_comments (
      id TEXT PRIMARY KEY,
      ${userColumn}
      correction_id TEXT NOT NULL,
      submission_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL,
      body TEXT NOT NULL,
      anchor_json TEXT NOT NULL,
      tags_json TEXT NOT NULL
    );
    CREATE TABLE attachments (
      id TEXT PRIMARY KEY,
      ${userColumn}
      exam_id TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT,
      size INTEGER NOT NULL,
      relative_path TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE tags (
      id TEXT PRIMARY KEY,
      ${userColumn}
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );
    CREATE TABLE exam_tags (
      ${userColumn}
      exam_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (exam_id, tag_id)
    );
  `)
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('schema_version', String(version))
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('app_version', '0.1.0')
  if (version === 2) {
    db.prepare(
      `
      INSERT INTO users
        (id, display_name, kind, remote_user_id, onboarding_completed_at, tour_completed_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(userId, 'Lokaler Nutzer', 'local', null, null, null, now, now)
    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('current_user_id', userId)
  }
  db.prepare(
    `
    INSERT INTO folders (${userReference}id, name, parent_id, trashed_at, created_at, updated_at)
    VALUES (${userValue}?, ?, ?, ?, ?, ?)
  `
  ).run(crypto.randomUUID(), 'Legacy', null, null, now, now)
  db.close()
}
