import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join, relative } from 'node:path'
import JSZip from 'jszip'
import {
  APP_VERSION,
  DOCUMENT_SCHEMA_VERSION,
  EDITOR_SCHEMA_VERSION,
  EMPTY_TIPTAP_DOCUMENT,
  JURA_FORMAT,
  JURA_FORMAT_VERSION
} from '@shared/constants'
import {
  aiCorrectionDraftSchema,
  attachmentRoleSchema,
  attachmentSchema,
  commentAnchorSchema,
  correctionSchema,
  documentSchema,
  examListItemSchema,
  examStatusSchema,
  examTypeSchema,
  folderSchema,
  juraManifestSchema,
  learningTaskSchema,
  legalAreaSchema,
  revisionSchema,
  scoreSchema,
  submissionSchema,
  userSchema,
  type Attachment,
  type AttachmentRole,
  type AiCorrectionDraft,
  type CommentAnchor,
  type Correction,
  type ExamRevision,
  type ExamStatus,
  type InlineComment,
  type LearningTask,
  type JuraDocument,
  type JuraManifest,
  type Submission,
  type User
} from '@shared/schemas'
import type {
  AddInlineCommentInput,
  AiSettingsStatus,
  AnalyticsEntry,
  CreateExamInput,
  ExamDetails,
  ExamListItem,
  FolderDto,
  SaveAiCorrectionDraftInput,
  SaveAiSettingsInput,
  SubmissionDetails,
  TrashFolderInput,
  UpdateCorrectionInput,
  UpdateFolderInput,
  UpdateExamInput
} from '@shared/ipc'
import { openDatabase, type SqliteDatabase } from './database'
import {
  buildAiCorrectionPrompt,
  requestOpenAiCorrection,
  tiptapToPlainText,
  type AiCorrectionRequestAttachment
} from './aiCorrection'
import { ensureParentDir, hashJson, newId, nowIso, parseJson, stringifyJson } from './utils'

type Row = Record<string, unknown>
type ImportedAttachment = {
  attachment: Attachment
  payload: Buffer
}

export class AppServices {
  readonly db: SqliteDatabase
  readonly filesDir: string

  constructor(
    readonly dataDir: string,
    dbPath = join(dataDir, 'database.sqlite')
  ) {
    this.filesDir = join(dataDir, 'files')
    this.db = openDatabase(dbPath)
    this.ensureCurrentUser()
  }

  close(): void {
    this.db.close()
  }

  getCurrentUser(): User {
    const currentUserId = this.getCurrentUserId()
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(currentUserId) as Row | undefined
    if (!row) return this.ensureCurrentUser()
    return userFromRow(row)
  }

  listUsers(): User[] {
    const rows = this.db.prepare('SELECT * FROM users ORDER BY updated_at DESC').all() as Row[]
    return rows.map(userFromRow)
  }

  createUser(displayName: string, kind: User['kind'] = 'local'): User {
    const id = newId()
    const now = nowIso()
    this.db
      .prepare(
        `
        INSERT INTO users
          (id, display_name, kind, remote_user_id, onboarding_completed_at, tour_completed_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(id, displayName.trim() || 'Lokaler Nutzer', kind, null, null, null, now, now)
    this.setCurrentUserId(id)
    return this.getCurrentUser()
  }

  switchUser(userId: string): User {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Row | undefined
    if (!row) throw new Error(`User not found: ${userId}`)
    this.setCurrentUserId(userId)
    return userFromRow(row)
  }

  completeOnboarding(userId: string): User {
    return this.updateUserTimestamp(userId, 'onboarding_completed_at')
  }

  completeTour(userId: string): User {
    return this.updateUserTimestamp(userId, 'tour_completed_at')
  }

  resetTour(userId: string): User {
    const now = nowIso()
    this.db
      .prepare('UPDATE users SET onboarding_completed_at = NULL, tour_completed_at = NULL, updated_at = ? WHERE id = ?')
      .run(now, userId)
    return this.switchUser(userId)
  }

  listFolders(): FolderDto[] {
    const userId = this.getCurrentUserId()
    const rows = this.db
      .prepare(
        'SELECT id, user_id, name, parent_id, trashed_at, created_at, updated_at FROM folders WHERE user_id = ? ORDER BY trashed_at IS NOT NULL, name'
      )
      .all(userId) as Row[]
    return rows.map(folderFromRow)
  }

  createFolder(name: string, parentId: string | null = null): FolderDto {
    if (parentId) this.requireActiveFolder(parentId)
    const id = newId()
    const userId = this.getCurrentUserId()
    const createdAt = nowIso()
    this.db
      .prepare(
        'INSERT INTO folders (id, user_id, name, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(id, userId, name.trim() || 'Neuer Ordner', parentId, createdAt, createdAt)
    return this.listFolders().find((folder) => folder.id === id)!
  }

  updateFolder(input: UpdateFolderInput): FolderDto {
    const folder = this.getFolder(input.id)
    if (folder.trashedAt) throw new Error('Papierkorb-Ordner kann nicht umbenannt werden')

    const updatedAt = nowIso()
    this.db
      .prepare('UPDATE folders SET name = ?, updated_at = ? WHERE id = ?')
      .run(input.name.trim() || 'Neuer Ordner', updatedAt, input.id)

    return this.getFolder(input.id)
  }

  trashFolder(input: TrashFolderInput): FolderDto {
    const folder = this.getFolder(input.id)
    if (folder.trashedAt) return folder

    if (input.moveExamsToFolderId === input.id) {
      throw new Error('Einträge können nicht in denselben Ordner verschoben werden')
    }

    if (input.moveExamsToFolderId) {
      this.requireActiveFolder(input.moveExamsToFolderId)
    }

    const updatedAt = nowIso()
    this.db.transaction(() => {
      this.db
        .prepare('UPDATE exams SET folder_id = ?, updated_at = ? WHERE folder_id = ?')
        .run(input.moveExamsToFolderId ?? null, updatedAt, input.id)
      this.db
        .prepare('UPDATE folders SET trashed_at = ?, updated_at = ? WHERE id = ?')
        .run(updatedAt, updatedAt, input.id)
    })()

    return this.getFolder(input.id)
  }

  restoreFolder(folderId: string): FolderDto {
    const folder = this.getFolder(folderId)
    if (!folder.trashedAt) return folder

    const updatedAt = nowIso()
    this.db
      .prepare('UPDATE folders SET trashed_at = NULL, updated_at = ? WHERE id = ?')
      .run(updatedAt, folderId)
    return this.getFolder(folderId)
  }

  listExams(): ExamListItem[] {
    const userId = this.getCurrentUserId()
    const rows = this.db
      .prepare(
        `
        SELECT
          e.*,
          f.name AS folder_name,
          r.created_at AS last_saved_at,
          (
            SELECT c.score_points
            FROM corrections c
            JOIN submissions s ON s.id = c.submission_id
        WHERE s.exam_id = e.id AND c.score_points IS NOT NULL AND c.user_id = e.user_id
            ORDER BY c.updated_at DESC
            LIMIT 1
          ) AS latest_score
        FROM exams e
        LEFT JOIN folders f ON f.id = e.folder_id AND f.trashed_at IS NULL
        LEFT JOIN exam_revisions r ON r.id = e.current_revision_id
        WHERE e.user_id = ?
        ORDER BY e.updated_at DESC
      `
      )
      .all(userId) as Row[]
    return rows.map(examListItemFromRow)
  }

  createExam(input: CreateExamInput): ExamDetails {
    if (input.folderId) this.requireActiveFolder(input.folderId)
    const legalArea = input.legalArea === undefined ? null : legalAreaSchema.nullable().parse(input.legalArea)
    const examType = input.examType === undefined ? null : examTypeSchema.nullable().parse(input.examType)
    const id = newId()
    const userId = this.getCurrentUserId()
    const revisionId = newId()
    const createdAt = nowIso()
    const content = structuredClone(EMPTY_TIPTAP_DOCUMENT) as Record<string, unknown>
    const contentHash = hashJson(content)
    const tags = normalizeTags(input.tags ?? [])

    this.db
      .transaction(() => {
        this.db
          .prepare(
            `
            INSERT INTO exams
              (id, user_id, title, folder_id, status, tags_json, notes, legal_area, exam_type, source_name, source_url, current_revision_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
          )
          .run(
            id,
            userId,
            input.title.trim() || 'Neue Klausur',
            input.folderId ?? null,
            'draft',
            stringifyJson(tags),
            '',
            legalArea,
            examType,
            input.sourceName ?? null,
            input.sourceUrl ?? null,
            revisionId,
            createdAt,
            createdAt
          )

        this.db
          .prepare(
            `
            INSERT INTO exam_revisions
              (id, user_id, exam_id, created_at, kind, content_format, content_hash, content_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `
          )
          .run(revisionId, userId, id, createdAt, 'initial', 'tiptap-v1', contentHash, stringifyJson(content))
      })()

    return this.getExam(id)
  }

  getExam(id: string): ExamDetails {
    const row = this.db
      .prepare(
        `
        SELECT e.*, f.name AS folder_name, r.created_at AS last_saved_at, NULL AS latest_score
        FROM exams e
        LEFT JOIN folders f ON f.id = e.folder_id AND f.trashed_at IS NULL
        LEFT JOIN exam_revisions r ON r.id = e.current_revision_id
        WHERE e.id = ? AND e.user_id = ?
      `
      )
      .get(id, this.getCurrentUserId()) as Row | undefined

    if (!row) throw new Error(`Exam not found: ${id}`)

    const item = examListItemFromRow(row)
    item.latestScore = this.getLatestScore(id)

    return {
      ...item,
      currentRevision: item.currentRevisionId ? this.getRevision(item.currentRevisionId) : null,
      submissions: this.listSubmissionsForExam(id),
      attachments: this.listAttachmentsForExam(id)
    }
  }

  updateExam(input: UpdateExamInput): ExamDetails {
    const current = this.getExam(input.id)
    const updatedAt = nowIso()
    if (input.folderId) this.requireActiveFolder(input.folderId)
    const legalArea =
      input.legalArea === undefined ? current.legalArea : legalAreaSchema.nullable().parse(input.legalArea)
    const examType =
      input.examType === undefined ? current.examType : examTypeSchema.nullable().parse(input.examType)
    const status = input.status === undefined ? current.status : examStatusSchema.parse(input.status)
    const next = {
      title: input.title ?? current.title,
      folderId: input.folderId === undefined ? current.folderId : input.folderId,
      status,
      tags: input.tags ? normalizeTags(input.tags) : current.tags,
      notes: input.notes ?? current.notes,
      legalArea,
      examType,
      sourceName: input.sourceName === undefined ? current.sourceName : input.sourceName,
      sourceUrl: input.sourceUrl === undefined ? current.sourceUrl : input.sourceUrl
    }

    this.db
      .prepare(
        `
        UPDATE exams
        SET title = ?, folder_id = ?, status = ?, tags_json = ?, notes = ?, legal_area = ?, exam_type = ?, source_name = ?, source_url = ?, updated_at = ?
        WHERE id = ?
      `
      )
      .run(
        next.title.trim() || 'Unbenannte Klausur',
        next.folderId,
        next.status,
        stringifyJson(next.tags),
        next.notes,
        next.legalArea ?? null,
        next.examType ?? null,
        next.sourceName ?? null,
        next.sourceUrl ?? null,
        updatedAt,
        input.id
      )

    return this.getExam(input.id)
  }

  trashExam(id: string): ExamDetails {
    const exam = this.getExam(id)
    if (exam.status === 'archived') return exam

    this.db
      .prepare('UPDATE exams SET status = ?, updated_at = ? WHERE id = ?')
      .run('archived', nowIso(), id)
    return this.getExam(id)
  }

  restoreExam(id: string): ExamDetails {
    const exam = this.getExam(id)
    if (exam.status !== 'archived') return exam

    const restoredStatus: ExamStatus = exam.currentRevisionId ? 'in_progress' : 'draft'
    this.db
      .prepare('UPDATE exams SET status = ?, updated_at = ? WHERE id = ?')
      .run(restoredStatus, nowIso(), id)
    return this.getExam(id)
  }

  saveRevision(
    examId: string,
    content: Record<string, unknown>,
    kind: 'autosave' | 'manual' | 'submission' = 'autosave'
  ): ExamRevision {
    this.getExam(examId)
    const id = newId()
    const userId = this.getCurrentUserId()
    const createdAt = nowIso()
    const contentHash = hashJson(content)

    this.db
      .transaction(() => {
        this.db
          .prepare(
            `
            INSERT INTO exam_revisions
              (id, user_id, exam_id, created_at, kind, content_format, content_hash, content_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `
          )
          .run(id, userId, examId, createdAt, kind, 'tiptap-v1', contentHash, stringifyJson(content))
        this.db
          .prepare('UPDATE exams SET current_revision_id = ?, updated_at = ?, status = ? WHERE id = ?')
          .run(id, createdAt, 'in_progress', examId)
      })()

    return this.getRevision(id)
  }

  submitExam(examId: string): Submission {
    const exam = this.getExam(examId)
    if (!exam.currentRevision) throw new Error('Cannot submit an exam without a revision')

    const id = newId()
    const userId = this.getCurrentUserId()
    const submittedAt = nowIso()
    this.db
      .transaction(() => {
        this.db
          .prepare(
            `
            INSERT INTO submissions
              (id, user_id, exam_id, submitted_at, revision_id, content_hash, pdf_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `
          )
          .run(id, userId, examId, submittedAt, exam.currentRevision!.id, exam.currentRevision!.contentHash, null)
        this.db.prepare('UPDATE exams SET status = ?, updated_at = ? WHERE id = ?').run(
          'submitted',
          submittedAt,
          examId
        )
      })()

    return this.getSubmissionRecord(id)
  }

  getSubmission(id: string): SubmissionDetails {
    const submission = this.getSubmissionRecord(id)
    const revision = this.getRevision(submission.revisionId)
    const exam = this.getExam(submission.examId)

    return {
      ...submission,
      examTitle: exam.title,
      content: revision.content,
      contentHash: revision.contentHash,
      corrections: this.listCorrectionsForSubmission(id)
    }
  }

  listAnalyticsEntries(): AnalyticsEntry[] {
    const userId = this.getCurrentUserId()
    const rows = this.db
      .prepare(
        `
        SELECT
          c.id AS correction_id,
          c.updated_at AS corrected_at,
          c.score_points,
          c.tags_json AS correction_tags_json,
          s.id AS submission_id,
          s.submitted_at,
          e.id AS exam_id,
          e.title AS exam_title,
          e.tags_json AS exam_tags_json
        FROM corrections c
        JOIN submissions s ON s.id = c.submission_id
        JOIN exams e ON e.id = s.exam_id
        WHERE c.score_points IS NOT NULL AND c.user_id = ?
        ORDER BY c.updated_at ASC, c.id ASC
      `
      )
      .all(userId) as Row[]

    return rows.map((row) => ({
      correctionId: String(row.correction_id),
      submissionId: String(row.submission_id),
      examId: String(row.exam_id),
      examTitle: String(row.exam_title),
      scorePoints: Number(row.score_points),
      submittedAt: String(row.submitted_at),
      correctedAt: String(row.corrected_at),
      examTags: parseJson(String(row.exam_tags_json), [] as string[]),
      correctionTags: parseJson(String(row.correction_tags_json), [] as string[])
    }))
  }

  getAiSettingsStatus(): AiSettingsStatus {
    const row = this.db
      .prepare('SELECT provider, api_key, model, updated_at FROM ai_settings WHERE user_id = ?')
      .get(this.getCurrentUserId()) as
      | { provider: string; api_key: string; model: string; updated_at: string }
      | undefined

    return {
      provider: 'openai',
      configured: Boolean(row?.api_key),
      model: row?.model ?? null,
      updatedAt: row?.updated_at ?? null
    }
  }

  saveAiSettings(input: SaveAiSettingsInput): AiSettingsStatus {
    const userId = this.getCurrentUserId()
    const updatedAt = nowIso()
    const provider = (input as { provider?: unknown }).provider
    const apiKey = input.apiKey.trim()
    const model = input.model.trim()
    if (provider !== 'openai') throw new Error('AI provider wird noch nicht unterstuetzt.')
    if (!apiKey) throw new Error('OpenAI API key darf nicht leer sein')
    if (!model) throw new Error('OpenAI model darf nicht leer sein')
    this.db
      .prepare(
        `
        INSERT INTO ai_settings (user_id, provider, api_key, model, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          provider = excluded.provider,
          api_key = excluded.api_key,
          model = excluded.model,
          updated_at = excluded.updated_at
      `
      )
      .run(userId, provider, apiKey, model, updatedAt)
    return this.getAiSettingsStatus()
  }

  async generateAiCorrectionDraft(submissionId: string): Promise<AiCorrectionDraft> {
    const settings = this.getAiSettingsCredentials()
    if (!settings) {
      throw new Error('KI-Korrektur ist nicht konfiguriert. Bitte OpenAI API key und Modell hinterlegen.')
    }

    const submission = this.getSubmission(submissionId)
    const exam = this.getExam(submission.examId)
    const attachments = exam.attachments
      .filter((attachment) =>
        ['assignment', 'model_solution', 'candidate_note'].includes(attachment.role)
      )
      .filter((attachment) => isPdfAttachment(attachment))
      .map(
        (attachment): AiCorrectionRequestAttachment => ({
          role: attachment.role,
          name: attachment.originalName,
          absolutePath: join(this.filesDir, attachment.relativePath),
          mimeType: attachment.mimeType ?? 'application/pdf',
          size: attachment.size
        })
      )
    const prompt = buildAiCorrectionPrompt({
      examTitle: exam.title,
      examTags: exam.tags,
      examNotes: exam.notes,
      legalArea: exam.legalArea,
      examType: exam.examType,
      submittedAt: submission.submittedAt,
      submissionText: tiptapToPlainText(submission.content),
      attachments: attachments.map((attachment) => ({
        role: attachment.role,
        name: attachment.name
      }))
    })
    const result = await requestOpenAiCorrection({
      apiKey: settings.apiKey,
      model: settings.model,
      prompt,
      attachments
    })

    return this.saveAiCorrectionDraft({
      submissionId,
      provider: 'openai',
      model: settings.model,
      ...result
    })
  }

  createCorrection(submissionId: string): Correction {
    this.getSubmissionRecord(submissionId)
    const existing = this.listCorrectionsForSubmission(submissionId)[0]
    if (existing) return existing

    const id = newId()
    const userId = this.getCurrentUserId()
    const createdAt = nowIso()
    this.db
      .prepare(
        `
        INSERT INTO corrections
          (id, user_id, submission_id, created_at, updated_at, score_points, grading_comment, tags_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(id, userId, submissionId, createdAt, createdAt, null, '', '[]')
    return this.getCorrection(id)
  }

  updateCorrection(input: UpdateCorrectionInput): Correction {
    scoreSchema.parse({ system: 'bayern-0-18', points: input.scorePoints })
    const updatedAt = nowIso()
    this.db
      .prepare(
        `
        UPDATE corrections
        SET score_points = ?, grading_comment = ?, tags_json = ?, updated_at = ?
        WHERE id = ?
      `
      )
      .run(
        input.scorePoints,
        input.gradingComment,
        stringifyJson(normalizeTags(input.tags)),
        updatedAt,
        input.correctionId
      )

    const correction = this.getCorrection(input.correctionId)
    const submission = this.getSubmissionRecord(correction.targetSubmissionId)
    if (input.scorePoints !== null) {
      this.db.prepare('UPDATE exams SET status = ?, updated_at = ? WHERE id = ?').run(
        'corrected',
        updatedAt,
        submission.examId
      )
    }
    return correction
  }

  addInlineComment(input: AddInlineCommentInput): InlineComment {
    commentAnchorSchema.parse(input.anchor)
    const correction = this.getCorrection(input.correctionId)
    if (correction.targetSubmissionId !== input.submissionId) {
      throw new Error('Inline comment target does not match correction target')
    }

    const id = newId()
    const userId = this.getCurrentUserId()
    const createdAt = nowIso()
    this.db
      .prepare(
        `
        INSERT INTO inline_comments
          (id, user_id, correction_id, submission_id, created_at, status, body, anchor_json, tags_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        id,
        userId,
        input.correctionId,
        input.submissionId,
        createdAt,
        'open',
        input.body,
        stringifyJson(input.anchor),
        stringifyJson(normalizeTags(input.tags))
      )

    return this.getInlineComment(id)
  }

  saveAiCorrectionDraft(input: SaveAiCorrectionDraftInput): AiCorrectionDraft {
    scoreSchema.parse({ system: 'bayern-0-18', points: input.scorePoints })
    const parsed = aiCorrectionDraftSchema.parse({
      schemaVersion: 1,
      id: newId(),
      userId: this.getCurrentUserId(),
      submissionId: input.submissionId,
      correctionId: null,
      status: 'draft',
      provider: input.provider,
      model: input.model,
      promptVersion: 'ai-correction-v1',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      score: { system: 'bayern-0-18', points: input.scorePoints },
      scoreReasoning: input.scoreReasoning,
      gradingComment: input.gradingComment,
      strengths: input.strengths,
      weaknesses: input.weaknesses,
      tags: normalizeTags(input.tags),
      confidence: input.confidence,
      improvementSuggestions: input.improvementSuggestions,
      inlineComments: input.inlineComments
    })
    this.getSubmissionRecord(parsed.submissionId)

    this.db
      .prepare(
        `
        INSERT INTO ai_correction_drafts
          (id, user_id, submission_id, correction_id, status, provider, model, prompt_version, created_at, updated_at, score_points, score_reasoning, grading_comment, strengths_json, weaknesses_json, tags_json, confidence, improvement_suggestions_json, inline_comments_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        parsed.id,
        parsed.userId,
        parsed.submissionId,
        null,
        parsed.status,
        parsed.provider,
        parsed.model,
        parsed.promptVersion,
        parsed.createdAt,
        parsed.updatedAt,
        parsed.score.points,
        parsed.scoreReasoning,
        parsed.gradingComment,
        stringifyJson(parsed.strengths),
        stringifyJson(parsed.weaknesses),
        stringifyJson(parsed.tags),
        parsed.confidence,
        stringifyJson(parsed.improvementSuggestions),
        stringifyJson(parsed.inlineComments)
      )

    return this.getAiCorrectionDraft(parsed.id)
  }

  listAiCorrectionDrafts(submissionId: string): AiCorrectionDraft[] {
    this.getSubmissionRecord(submissionId)
    const rows = this.db
      .prepare(
        'SELECT * FROM ai_correction_drafts WHERE submission_id = ? AND user_id = ? ORDER BY updated_at DESC'
      )
      .all(submissionId, this.getCurrentUserId()) as Row[]
    return rows.map(aiCorrectionDraftFromRow)
  }

  acceptAiCorrectionDraft(draftId: string): AiCorrectionDraft {
    const draft = this.getAiCorrectionDraft(draftId)
    if (draft.status !== 'draft') {
      throw new Error(`AI correction draft must have status draft to accept; current status is ${draft.status}`)
    }
    const updatedAt = nowIso()

    this.db.transaction(() => {
      const correction = this.createCorrection(draft.submissionId)
      const updatedCorrection = this.updateCorrection({
        correctionId: correction.id,
        scorePoints: draft.score.points,
        gradingComment: draft.gradingComment,
        tags: draft.tags
      })

      for (const suggestion of draft.improvementSuggestions) {
        this.db
          .prepare(
            `
            INSERT INTO learning_tasks
              (id, user_id, submission_id, correction_id, ai_draft_id, category, priority, status, title, detail, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
          )
          .run(
            newId(),
            draft.userId,
            draft.submissionId,
            updatedCorrection.id,
            draft.id,
            suggestion.category,
            suggestion.priority,
            'open',
            suggestion.title,
            suggestion.detail,
            updatedAt,
            updatedAt
          )
      }

      this.db
        .prepare(
          'UPDATE ai_correction_drafts SET status = ?, correction_id = ?, updated_at = ? WHERE id = ? AND user_id = ?'
        )
        .run('accepted', updatedCorrection.id, updatedAt, draft.id, draft.userId)
      this.db
        .prepare(
          `
          UPDATE ai_correction_drafts
          SET status = ?, updated_at = ?
          WHERE submission_id = ? AND id != ? AND status = ? AND user_id = ?
        `
        )
        .run('superseded', updatedAt, draft.submissionId, draft.id, 'draft', draft.userId)
    })()

    return this.getAiCorrectionDraft(draft.id)
  }

  rejectAiCorrectionDraft(draftId: string): AiCorrectionDraft {
    const draft = this.getAiCorrectionDraft(draftId)
    if (draft.status !== 'draft') {
      throw new Error(`AI correction draft must have status draft to reject; current status is ${draft.status}`)
    }
    this.db
      .prepare('UPDATE ai_correction_drafts SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .run('rejected', nowIso(), draftId, this.getCurrentUserId())
    return this.getAiCorrectionDraft(draftId)
  }

  listLearningTasks(): LearningTask[] {
    const rows = this.db
      .prepare('SELECT * FROM learning_tasks WHERE user_id = ? ORDER BY created_at ASC, id ASC')
      .all(this.getCurrentUserId()) as Row[]
    return rows.map(learningTaskFromRow)
  }

  updateLearningTaskStatus(taskId: string, status: LearningTask['status']): LearningTask {
    learningTaskSchema.shape.status.parse(status)
    this.getLearningTask(taskId)
    this.db
      .prepare('UPDATE learning_tasks SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .run(status, nowIso(), taskId, this.getCurrentUserId())
    return this.getLearningTask(taskId)
  }

  async addAttachmentFromPath(
    examId: string,
    sourcePath: string,
    role: AttachmentRole = 'other'
  ): Promise<Attachment> {
    const parsedRole = attachmentRoleSchema.parse(role)
    this.getExam(examId)
    const sourceStats = await stat(sourcePath)
    const id = newId()
    const userId = this.getCurrentUserId()
    const originalName = basename(sourcePath)
    const storedName = `${id}${extname(originalName)}`
    const relativePath = join('exams', examId, 'attachments', id, storedName)
    const targetPath = join(this.filesDir, relativePath)
    const createdAt = nowIso()

    await ensureParentDir(targetPath)
    await copyFile(sourcePath, targetPath)

    this.db
      .prepare(
        `
        INSERT INTO attachments
          (id, user_id, exam_id, original_name, stored_name, mime_type, size, relative_path, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(id, userId, examId, originalName, storedName, null, sourceStats.size, relativePath, parsedRole, createdAt)

    return attachmentSchema.parse({
      schemaVersion: 1,
      id,
      userId,
      examId,
      originalName,
      storedName,
      mimeType: null,
      size: sourceStats.size,
      relativePath,
      role: parsedRole,
      createdAt
    })
  }

  getAttachmentPath(attachmentId: string): string {
    const row = this.db
      .prepare('SELECT relative_path FROM attachments WHERE id = ? AND user_id = ?')
      .get(attachmentId, this.getCurrentUserId()) as { relative_path: string } | undefined
    if (!row) throw new Error(`Attachment not found: ${attachmentId}`)
    return join(this.filesDir, row.relative_path)
  }

  async exportExamPackage(examId: string, outputPath: string): Promise<string> {
    const exam = this.getExam(examId)
    const zip = new JSZip()
    const createdAt = nowIso()
    const revisions = this.listRevisionsForExam(examId)
    const submissions = this.listSubmissionsForExam(examId)
    const corrections = submissions.flatMap((submission) => this.listCorrectionsForSubmission(submission.id))
    const folderPath = exam.folderName ? [exam.folderName] : []

    const manifest: JuraManifest = {
      format: JURA_FORMAT,
      formatVersion: JURA_FORMAT_VERSION,
      minimumAppVersion: APP_VERSION,
      createdWithAppVersion: APP_VERSION,
      documentSchemaVersion: DOCUMENT_SCHEMA_VERSION,
      createdAt,
      documentId: exam.id
    }
    const document: JuraDocument = {
      schemaVersion: DOCUMENT_SCHEMA_VERSION,
      documentType: 'jura-klausur',
      id: exam.id,
      title: exam.title,
      status: exam.status,
      folderPath,
      tags: exam.tags,
      notes: exam.notes,
      createdAt: exam.createdAt,
      updatedAt: exam.updatedAt,
      currentRevisionId: exam.currentRevisionId,
      submissions: submissions.map((submission) => submission.id),
      corrections: corrections.map((correction) => correction.id),
      attachments: exam.attachments.map((attachment) => attachment.id),
      legalArea: exam.legalArea,
      examType: exam.examType,
      sourceName: exam.sourceName,
      sourceUrl: exam.sourceUrl
    }

    zip.file('manifest.json', JSON.stringify(juraManifestSchema.parse(manifest), null, 2))
    zip.file('document.json', JSON.stringify(documentSchema.parse(document), null, 2))
    if (exam.currentRevision) {
      zip.file('content/current.json', JSON.stringify(revisionSchema.parse(exam.currentRevision), null, 2))
    }
    for (const revision of revisions) {
      zip.file(`content/revisions/${revision.id}.json`, JSON.stringify(revisionSchema.parse(revision), null, 2))
    }
    for (const submission of submissions) {
      const details = this.getSubmission(submission.id)
      zip.file(
        `submissions/${submission.id}/submission.json`,
        JSON.stringify(submissionSchema.parse(submission), null, 2)
      )
      zip.file(`submissions/${submission.id}/content.json`, JSON.stringify(details.content, null, 2))
    }
    for (const correction of corrections) {
      zip.file(
        `corrections/${correction.id}/correction.json`,
        JSON.stringify(correctionSchema.parse(correction), null, 2)
      )
    }
    for (const attachment of exam.attachments) {
      const absolutePath = join(this.filesDir, attachment.relativePath)
      if (existsSync(absolutePath)) {
        const data = await readFile(absolutePath)
        zip.file(`attachments/${attachment.id}/${attachment.originalName}`, data)
        zip.file(`attachments/${attachment.id}/attachment.json`, JSON.stringify(attachment, null, 2))
      }
    }

    const buffer = await zip.generateAsync({ type: 'nodebuffer' })
    await ensureParentDir(outputPath)
    await writeFile(outputPath, buffer)
    return outputPath
  }

  async importExamPackage(inputPath: string): Promise<ExamDetails> {
    const zip = await JSZip.loadAsync(await readFile(inputPath))
    const manifest = juraManifestSchema.parse(
      JSON.parse(await readZipText(zip, 'manifest.json'))
    )
    if (manifest.formatVersion > JURA_FORMAT_VERSION) {
      throw new Error(`Unsupported .jura format version: ${manifest.formatVersion}`)
    }

    const document = documentSchema.parse(JSON.parse(await readZipText(zip, 'document.json')))
    const userId = this.getCurrentUserId()
    const examId = this.hasExam(document.id) ? newId() : document.id
    const idMap = new Map<string, string>([[document.id, examId]])
    const createdAt = nowIso()
    const title = this.hasExam(document.id) ? `${document.title} (importiert)` : document.title

    const revisionFiles = Object.keys(zip.files)
      .filter((file) => file.startsWith('content/revisions/') && file.endsWith('.json'))
      .sort()
    const revisions = await Promise.all(
      revisionFiles.map(async (revisionFile) =>
        revisionSchema.parse({ userId, ...JSON.parse(await readZipText(zip, revisionFile)) })
      )
    )
    for (const revision of revisions) {
      const nextRevisionId = this.hasRevision(revision.id) ? newId() : revision.id
      idMap.set(revision.id, nextRevisionId)
    }

    const currentRevisionId = document.currentRevisionId
      ? requireImportedId(idMap, document.currentRevisionId, 'current revision')
      : null

    const submissionFiles = Object.keys(zip.files)
      .filter((file) => file.endsWith('/submission.json'))
      .sort()
    const submissions = await Promise.all(
      submissionFiles.map(async (submissionFile) =>
        submissionSchema.parse({ userId, ...JSON.parse(await readZipText(zip, submissionFile)) })
      )
    )
    for (const submission of submissions) {
      requireImportedId(idMap, submission.revisionId, 'submission revision')
      const nextSubmissionId = this.hasSubmission(submission.id) ? newId() : submission.id
      idMap.set(submission.id, nextSubmissionId)
    }

    const correctionFiles = Object.keys(zip.files)
      .filter((file) => file.startsWith('corrections/') && file.endsWith('/correction.json'))
      .sort()
    const corrections = await Promise.all(
      correctionFiles.map(async (correctionFile) => {
        const correction = JSON.parse(await readZipText(zip, correctionFile))
        return correctionSchema.parse({
          userId,
          ...correction,
          inlineComments: correction.inlineComments.map((comment: Record<string, unknown>) => ({
            userId,
            ...comment
          }))
        })
      })
    )
    for (const correction of corrections) {
      requireImportedId(idMap, correction.targetSubmissionId, 'correction submission')
      const nextCorrectionId = this.hasCorrection(correction.id) ? newId() : correction.id
      idMap.set(correction.id, nextCorrectionId)
      for (const comment of correction.inlineComments) {
        requireImportedId(idMap, comment.targetSubmissionId, 'comment submission')
      }
    }

    const attachmentMetaFiles = Object.keys(zip.files)
      .filter((file) => file.startsWith('attachments/') && file.endsWith('/attachment.json'))
      .sort()
    const attachments = await Promise.all(
      attachmentMetaFiles.map(async (metaFile): Promise<ImportedAttachment | null> => {
        const attachment = attachmentSchema.parse({
          userId,
          ...JSON.parse(await readZipText(zip, metaFile))
        })
        const folder = metaFile.split('/').slice(0, 2).join('/')
        const payloadFile = Object.keys(zip.files).find(
          (file) =>
            file.startsWith(`${folder}/`) &&
            !file.endsWith('/attachment.json') &&
            !zip.files[file].dir
        )
        if (!payloadFile) return null
        return {
          attachment,
          payload: await zip.file(payloadFile)!.async('nodebuffer')
        }
      })
    )

    const writtenAttachmentPaths: string[] = []
    try {
      for (const imported of attachments) {
        if (!imported) continue
        const nextAttachmentId = this.hasAttachment(imported.attachment.id)
          ? newId()
          : imported.attachment.id
        idMap.set(imported.attachment.id, nextAttachmentId)
        const storedName = `${nextAttachmentId}${extname(imported.attachment.originalName)}`
        const relativePath = join('exams', examId, 'attachments', nextAttachmentId, storedName)
        const absolutePath = join(this.filesDir, relativePath)
        await ensureParentDir(absolutePath)
        await writeFile(absolutePath, imported.payload)
        writtenAttachmentPaths.push(absolutePath)
      }

      this.db.transaction(() => {
        this.db
          .prepare(
            `
            INSERT INTO exams
              (id, user_id, title, folder_id, status, tags_json, notes, legal_area, exam_type, source_name, source_url, current_revision_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
          )
          .run(
            examId,
            userId,
            title,
            null,
            document.status,
            stringifyJson(document.tags),
            document.notes,
            document.legalArea,
            document.examType,
            document.sourceName,
            document.sourceUrl,
            currentRevisionId,
            document.createdAt || createdAt,
            createdAt
          )

        for (const revision of revisions) {
          this.db
            .prepare(
              `
              INSERT INTO exam_revisions
                (id, user_id, exam_id, created_at, kind, content_format, content_hash, content_json)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `
            )
            .run(
              requireImportedId(idMap, revision.id, 'revision'),
              userId,
              examId,
              revision.createdAt,
              revision.kind,
              revision.contentFormat,
              revision.contentHash,
              stringifyJson(revision.content)
            )
        }

        for (const submission of submissions) {
          this.db
            .prepare(
              `
              INSERT INTO submissions
                (id, user_id, exam_id, submitted_at, revision_id, content_hash, pdf_path)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `
            )
            .run(
              requireImportedId(idMap, submission.id, 'submission'),
              userId,
              examId,
              submission.submittedAt,
              requireImportedId(idMap, submission.revisionId, 'submission revision'),
              submission.contentHash,
              null
            )
        }

        for (const correction of corrections) {
          const nextCorrectionId = requireImportedId(idMap, correction.id, 'correction')
          this.db
            .prepare(
              `
              INSERT INTO corrections
                (id, user_id, submission_id, created_at, updated_at, score_points, grading_comment, tags_json)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `
            )
            .run(
              nextCorrectionId,
              userId,
              requireImportedId(idMap, correction.targetSubmissionId, 'correction submission'),
              correction.createdAt,
              correction.updatedAt,
              correction.score.points,
              correction.gradingComment,
              stringifyJson(correction.tags)
            )

          for (const comment of correction.inlineComments) {
            const nextCommentId = this.hasInlineComment(comment.id) ? newId() : comment.id
            this.db
              .prepare(
                `
                INSERT INTO inline_comments
                  (id, user_id, correction_id, submission_id, created_at, status, body, anchor_json, tags_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `
              )
              .run(
                nextCommentId,
                userId,
                nextCorrectionId,
                requireImportedId(idMap, comment.targetSubmissionId, 'comment submission'),
                comment.createdAt,
                comment.status,
                comment.body,
                stringifyJson(comment.anchor),
                stringifyJson(comment.tags)
              )
          }
        }

        for (const imported of attachments) {
          if (!imported) continue
          const nextAttachmentId = requireImportedId(idMap, imported.attachment.id, 'attachment')
          const storedName = `${nextAttachmentId}${extname(imported.attachment.originalName)}`
          const relativePath = join('exams', examId, 'attachments', nextAttachmentId, storedName)
          this.db
            .prepare(
              `
              INSERT INTO attachments
                (id, user_id, exam_id, original_name, stored_name, mime_type, size, relative_path, role, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `
            )
            .run(
              nextAttachmentId,
              userId,
              examId,
              imported.attachment.originalName,
              storedName,
              imported.attachment.mimeType,
              imported.payload.byteLength,
              relativePath,
              imported.attachment.role,
              imported.attachment.createdAt
            )
        }
      })()
    } catch (error) {
      await Promise.all(writtenAttachmentPaths.map((path) => rm(path, { force: true })))
      throw error
    }

    return this.getExam(examId)
  }

  async deleteAllData(): Promise<void> {
    this.db.close()
    await rm(this.dataDir, { recursive: true, force: true })
  }

  private getRevision(id: string): ExamRevision {
    const row = this.db.prepare('SELECT * FROM exam_revisions WHERE id = ? AND user_id = ?').get(id, this.getCurrentUserId()) as
      | Row
      | undefined
    if (!row) throw new Error(`Revision not found: ${id}`)
    return revisionFromRow(row)
  }

  private listRevisionsForExam(examId: string): ExamRevision[] {
    const rows = this.db
      .prepare('SELECT * FROM exam_revisions WHERE exam_id = ? AND user_id = ? ORDER BY created_at ASC')
      .all(examId, this.getCurrentUserId()) as Row[]
    return rows.map(revisionFromRow)
  }

  private getSubmissionRecord(id: string): Submission {
    const row = this.db.prepare('SELECT * FROM submissions WHERE id = ? AND user_id = ?').get(id, this.getCurrentUserId()) as Row | undefined
    if (!row) throw new Error(`Submission not found: ${id}`)
    return submissionFromRow(row)
  }

  private listSubmissionsForExam(examId: string): Submission[] {
    const rows = this.db
      .prepare('SELECT * FROM submissions WHERE exam_id = ? AND user_id = ? ORDER BY submitted_at DESC')
      .all(examId, this.getCurrentUserId()) as Row[]
    return rows.map(submissionFromRow)
  }

  private getCorrection(id: string): Correction {
    const row = this.db.prepare('SELECT * FROM corrections WHERE id = ? AND user_id = ?').get(id, this.getCurrentUserId()) as Row | undefined
    if (!row) throw new Error(`Correction not found: ${id}`)
    return correctionFromRow(row, this.listInlineCommentsForCorrection(id))
  }

  private listCorrectionsForSubmission(submissionId: string): Correction[] {
    const rows = this.db
      .prepare('SELECT * FROM corrections WHERE submission_id = ? AND user_id = ? ORDER BY updated_at DESC')
      .all(submissionId, this.getCurrentUserId()) as Row[]
    return rows.map((row) => {
        const correctionId = String(row.id)
        return correctionFromRow(row, this.listInlineCommentsForCorrection(correctionId))
      })
  }

  private getInlineComment(id: string): InlineComment {
    const row = this.db.prepare('SELECT * FROM inline_comments WHERE id = ? AND user_id = ?').get(id, this.getCurrentUserId()) as
      | Row
      | undefined
    if (!row) throw new Error(`Inline comment not found: ${id}`)
    return inlineCommentFromRow(row)
  }

  private listInlineCommentsForCorrection(correctionId: string): InlineComment[] {
    const rows = this.db
      .prepare('SELECT * FROM inline_comments WHERE correction_id = ? AND user_id = ? ORDER BY created_at ASC')
      .all(correctionId, this.getCurrentUserId()) as Row[]
    return rows.map(inlineCommentFromRow)
  }

  private getAiCorrectionDraft(id: string): AiCorrectionDraft {
    const row = this.db
      .prepare('SELECT * FROM ai_correction_drafts WHERE id = ? AND user_id = ?')
      .get(id, this.getCurrentUserId()) as Row | undefined
    if (!row) throw new Error(`AI correction draft not found: ${id}`)
    return aiCorrectionDraftFromRow(row)
  }

  private getAiSettingsCredentials(): { provider: 'openai'; apiKey: string; model: string } | null {
    const row = this.db
      .prepare('SELECT provider, api_key, model FROM ai_settings WHERE user_id = ?')
      .get(this.getCurrentUserId()) as
      | { provider: string; api_key: string; model: string }
      | undefined

    const apiKey = row?.api_key?.trim()
    const model = row?.model?.trim()
    if (!row || !apiKey || !model) return null
    if (row.provider !== 'openai') throw new Error('AI provider wird noch nicht unterstuetzt.')
    return {
      provider: 'openai',
      apiKey,
      model
    }
  }

  private getLearningTask(id: string): LearningTask {
    const row = this.db
      .prepare('SELECT * FROM learning_tasks WHERE id = ? AND user_id = ?')
      .get(id, this.getCurrentUserId()) as Row | undefined
    if (!row) throw new Error(`Learning task not found: ${id}`)
    return learningTaskFromRow(row)
  }

  private listAttachmentsForExam(examId: string): Attachment[] {
    const rows = this.db
      .prepare('SELECT * FROM attachments WHERE exam_id = ? AND user_id = ? ORDER BY created_at DESC')
      .all(examId, this.getCurrentUserId()) as Row[]
    return rows.map(attachmentFromRow)
  }

  private getLatestScore(examId: string): number | null {
    const row = this.db
      .prepare(
        `
        SELECT c.score_points AS score
        FROM corrections c
        JOIN submissions s ON s.id = c.submission_id
        WHERE s.exam_id = ? AND c.score_points IS NOT NULL AND c.user_id = ?
        ORDER BY c.updated_at DESC
        LIMIT 1
      `
      )
      .get(examId, this.getCurrentUserId()) as { score: number | null } | undefined
    return row?.score ?? null
  }

  private hasExam(id: string): boolean {
    return Boolean(this.db.prepare('SELECT id FROM exams WHERE id = ?').get(id))
  }

  private hasRevision(id: string): boolean {
    return Boolean(this.db.prepare('SELECT id FROM exam_revisions WHERE id = ?').get(id))
  }

  private hasSubmission(id: string): boolean {
    return Boolean(this.db.prepare('SELECT id FROM submissions WHERE id = ?').get(id))
  }

  private hasCorrection(id: string): boolean {
    return Boolean(this.db.prepare('SELECT id FROM corrections WHERE id = ?').get(id))
  }

  private hasInlineComment(id: string): boolean {
    return Boolean(this.db.prepare('SELECT id FROM inline_comments WHERE id = ?').get(id))
  }

  private hasAttachment(id: string): boolean {
    return Boolean(this.db.prepare('SELECT id FROM attachments WHERE id = ?').get(id))
  }

  private getFolder(id: string): FolderDto {
    const row = this.db
      .prepare('SELECT id, user_id, name, parent_id, trashed_at, created_at, updated_at FROM folders WHERE id = ? AND user_id = ?')
      .get(id, this.getCurrentUserId()) as Row | undefined
    if (!row) throw new Error(`Folder not found: ${id}`)
    return folderFromRow(row)
  }

  private requireActiveFolder(folderId: string): FolderDto {
    const folder = this.getFolder(folderId)
    if (folder.trashedAt) {
      throw new Error('Papierkorb-Ordner kann nicht verwendet werden')
    }
    return folder
  }

  private ensureCurrentUser(): User {
    const currentUserId = this.getMetaValue('current_user_id')
    if (currentUserId) {
      const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(currentUserId) as Row | undefined
      if (row) return userFromRow(row)
    }

    const existing = this.db.prepare('SELECT * FROM users ORDER BY created_at ASC LIMIT 1').get() as Row | undefined
    if (existing) {
      const user = userFromRow(existing)
      this.setCurrentUserId(user.id)
      return user
    }

    return this.createUser('Lokaler Nutzer')
  }

  private getCurrentUserId(): string {
    const userId = this.getMetaValue('current_user_id')
    if (!userId) return this.ensureCurrentUser().id
    return userId
  }

  private setCurrentUserId(userId: string): void {
    this.db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('current_user_id', userId)
  }

  private getMetaValue(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    return row?.value ?? null
  }

  private updateUserTimestamp(userId: string, column: 'onboarding_completed_at' | 'tour_completed_at'): User {
    const now = nowIso()
    this.db.prepare(`UPDATE users SET ${column} = ?, updated_at = ? WHERE id = ?`).run(now, now, userId)
    return this.switchUser(userId)
  }
}

function userFromRow(row: Row): User {
  return userSchema.parse({
    id: String(row.id),
    displayName: String(row.display_name),
    kind: String(row.kind),
    remoteUserId: row.remote_user_id ? String(row.remote_user_id) : null,
    onboardingCompletedAt: row.onboarding_completed_at ? String(row.onboarding_completed_at) : null,
    tourCompletedAt: row.tour_completed_at ? String(row.tour_completed_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  })
}

function folderFromRow(row: Row): FolderDto {
  return folderSchema.parse({
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name),
    parentId: row.parent_id ? String(row.parent_id) : null,
    trashedAt: row.trashed_at ? String(row.trashed_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  })
}

function examListItemFromRow(row: Row): ExamListItem {
  return examListItemSchema.parse({
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title),
    folderId: row.folder_id ? String(row.folder_id) : null,
    folderName: row.folder_name ? String(row.folder_name) : null,
    status: String(row.status) as ExamStatus,
    tags: parseJson(String(row.tags_json), [] as string[]),
    notes: String(row.notes ?? ''),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastSavedAt: row.last_saved_at ? String(row.last_saved_at) : String(row.created_at),
    currentRevisionId: row.current_revision_id ? String(row.current_revision_id) : null,
    latestScore: row.latest_score === null || row.latest_score === undefined ? null : Number(row.latest_score),
    legalArea: row.legal_area ? String(row.legal_area) : null,
    examType: row.exam_type ? String(row.exam_type) : null,
    sourceName: row.source_name ? String(row.source_name) : null,
    sourceUrl: row.source_url ? String(row.source_url) : null
  })
}

function revisionFromRow(row: Row): ExamRevision {
  return revisionSchema.parse({
    schemaVersion: 1,
    editorSchemaVersion: EDITOR_SCHEMA_VERSION,
    id: String(row.id),
    userId: String(row.user_id),
    examId: String(row.exam_id),
    createdAt: String(row.created_at),
    kind: String(row.kind),
    contentFormat: String(row.content_format),
    contentHash: String(row.content_hash),
    content: parseJson(String(row.content_json), structuredClone(EMPTY_TIPTAP_DOCUMENT))
  })
}

function submissionFromRow(row: Row): Submission {
  return submissionSchema.parse({
    schemaVersion: 1,
    id: String(row.id),
    userId: String(row.user_id),
    examId: String(row.exam_id),
    submittedAt: String(row.submitted_at),
    revisionId: String(row.revision_id),
    contentHash: String(row.content_hash),
    canContinueEditing: true,
    pdfPath: row.pdf_path ? String(row.pdf_path) : null
  })
}

function correctionFromRow(row: Row, inlineComments: InlineComment[]): Correction {
  return correctionSchema.parse({
    schemaVersion: 1,
    id: String(row.id),
    userId: String(row.user_id),
    targetSubmissionId: String(row.submission_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    score: {
      system: 'bayern-0-18',
      points: row.score_points === null || row.score_points === undefined ? null : Number(row.score_points)
    },
    gradingComment: String(row.grading_comment ?? ''),
    tags: parseJson(String(row.tags_json), [] as string[]),
    inlineComments
  })
}

function inlineCommentFromRow(row: Row): InlineComment {
  return {
    schemaVersion: 1,
    id: String(row.id),
    userId: String(row.user_id),
    targetSubmissionId: String(row.submission_id),
    correctionId: String(row.correction_id),
    createdAt: String(row.created_at),
    status: String(row.status) as InlineComment['status'],
    body: String(row.body),
    anchor: parseJson(String(row.anchor_json), {}) as CommentAnchor,
    tags: parseJson(String(row.tags_json), [] as string[])
  }
}

function attachmentFromRow(row: Row): Attachment {
  return attachmentSchema.parse({
    schemaVersion: 1,
    id: String(row.id),
    userId: String(row.user_id),
    examId: String(row.exam_id),
    originalName: String(row.original_name),
    storedName: String(row.stored_name),
    mimeType: row.mime_type ? String(row.mime_type) : null,
    size: Number(row.size),
    relativePath: String(row.relative_path),
    role: row.role ? String(row.role) : 'other',
    createdAt: String(row.created_at)
  })
}

function isPdfAttachment(attachment: Attachment): boolean {
  return (
    attachment.mimeType === 'application/pdf' ||
    extname(attachment.originalName).toLowerCase() === '.pdf'
  )
}

function aiCorrectionDraftFromRow(row: Row): AiCorrectionDraft {
  return aiCorrectionDraftSchema.parse({
    schemaVersion: 1,
    id: String(row.id),
    userId: String(row.user_id),
    submissionId: String(row.submission_id),
    correctionId: row.correction_id ? String(row.correction_id) : null,
    status: String(row.status),
    provider: String(row.provider),
    model: String(row.model),
    promptVersion: String(row.prompt_version),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    score: {
      system: 'bayern-0-18',
      points: row.score_points === null || row.score_points === undefined ? null : Number(row.score_points)
    },
    scoreReasoning: String(row.score_reasoning),
    gradingComment: String(row.grading_comment),
    strengths: parseJson(String(row.strengths_json), [] as string[]),
    weaknesses: parseJson(String(row.weaknesses_json), [] as string[]),
    tags: parseJson(String(row.tags_json), [] as string[]),
    confidence: String(row.confidence),
    improvementSuggestions: parseJson(String(row.improvement_suggestions_json), []),
    inlineComments: parseJson(String(row.inline_comments_json), [])
  })
}

function learningTaskFromRow(row: Row): LearningTask {
  return learningTaskSchema.parse({
    schemaVersion: 1,
    id: String(row.id),
    userId: String(row.user_id),
    submissionId: String(row.submission_id),
    correctionId: row.correction_id ? String(row.correction_id) : null,
    aiDraftId: row.ai_draft_id ? String(row.ai_draft_id) : null,
    category: String(row.category),
    priority: String(row.priority),
    status: String(row.status),
    title: String(row.title),
    detail: String(row.detail),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  })
}

function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  )
}

async function readZipText(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path)
  if (!file) throw new Error(`Missing .jura file: ${path}`)
  return file.async('text')
}

function requireImportedId(idMap: Map<string, string>, id: string, label: string): string {
  const mapped = idMap.get(id)
  if (!mapped) throw new Error(`Invalid .jura package: missing ${label} ${id}`)
  return mapped
}

export function toRelativeFilesPath(filesDir: string, absolutePath: string): string {
  return relative(filesDir, absolutePath)
}
