import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import Database from 'better-sqlite3'
import JSZip from 'jszip'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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

    expect(currentUser.id).toMatch(UUID_PATTERN)
    expect(folderColumns.some((column) => column.name === 'user_id')).toBe(true)
    expect(examColumns.some((column) => column.name === 'user_id')).toBe(true)
    expect(services.listFolders()).toEqual([expect.objectContaining({ id: folderId, userId: currentUser.id })])
    expect(services.listExams()).toEqual([expect.objectContaining({ id: examId, userId: currentUser.id })])
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

  it('stores AI drafts and accepts them into the existing correction structure', () => {
    const exam = services.createExam({ title: 'KI Klausur', legalArea: 'civil', examType: 'judgment' })
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
      inlineComments: []
    })

    const accepted = services.acceptAiCorrectionDraft(draft.id)
    const details = services.getSubmission(submission.id)
    const tasks = services.listLearningTasks()

    expect(accepted.status).toBe('accepted')
    expect(details.corrections[0].score.points).toBe(7.5)
    expect(details.corrections[0].gradingComment).toContain('Ordentliche Grundlage')
    expect(details.corrections[0].tags).toEqual(['schwerpunktsetzung'])
    expect(tasks).toEqual([
      expect.objectContaining({
        submissionId: submission.id,
        category: 'structure',
        priority: 'high',
        status: 'open'
      })
    ])
  })

  it('persists AI settings for the current user', () => {
    expect(services.getAiSettingsStatus()).toEqual({
      provider: 'openai',
      configured: false,
      model: null,
      updatedAt: null
    })

    const saved = services.saveAiSettings({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-5'
    })

    expect(saved.configured).toBe(true)
    expect(saved.model).toBe('gpt-5')
    expect(saved.updatedAt).not.toBeNull()

    services.close()
    services = new AppServices(dataDir)

    expect(services.getAiSettingsStatus()).toEqual(saved)
  })

  it('exports and imports .jura packages with content, attachments and corrections', async () => {
    const exam = services.createExam({ title: 'Exportklausur', tags: ['strafrecht'] })
    services.saveRevision(exam.id, {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tatbestand.' }] }]
    })
    const sourcePath = join(dataDir, 'anlage.txt')
    await writeFile(sourcePath, 'Anlage')
    await services.addAttachmentFromPath(exam.id, sourcePath)
    const submission = services.submitExam(exam.id)
    const correction = services.createCorrection(submission.id)
    services.updateCorrection({
      correctionId: correction.id,
      scorePoints: 14.5,
      gradingComment: 'Gut.',
      tags: []
    })

    const packagePath = join(dataDir, 'export.jura')
    await services.exportExamPackage(exam.id, packagePath)

    const importedDir = await mkdtemp(join(tmpdir(), 'jura-import-'))
    const importedServices = new AppServices(importedDir)
    try {
      const imported = await importedServices.importExamPackage(packagePath)
      expect(imported.title).toBe('Exportklausur')
      expect(imported.tags).toEqual(['strafrecht'])
      expect(imported.attachments).toHaveLength(1)
      expect(imported.submissions).toHaveLength(1)
      expect(importedServices.getSubmission(imported.submissions[0].id).corrections[0].score.points).toBe(14.5)
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
