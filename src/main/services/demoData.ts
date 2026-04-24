import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EDITOR_SCHEMA_VERSION } from '@shared/constants'
import type { AppServices } from './services'
import { hashJson, newId, stringifyJson } from './utils'

type DemoComment = {
  selectedText: string
  body: string
}

type DemoExamMeta = {
  title: string
  folder: string
  submittedAt: string
  correctedAt: string
  score: number
  tags: string[]
  gradingComment: string
  comments: DemoComment[]
}

type DemoExam = DemoExamMeta & {
  body: string
}

const DEMO_SEED_KEY = 'demo_data_seeded_v2'
const DEMO_SOURCE_PATH = join(process.cwd(), 'demo', 'klausuren.md')

export function seedDemoDataIfEnabled(services: AppServices): void {
  if (process.env.JURA_DEMO_DATA === '0') return
  if (!existsSync(DEMO_SOURCE_PATH)) return
  if (isSeeded(services)) return

  const exams = readDemoExams(DEMO_SOURCE_PATH)
  if (!exams.length) return

  services.db.transaction(() => {
    const demoUser = services.createUser('Demo Nutzer', 'demo')
    services.switchUser(demoUser.id)
    seedDemoExams(services, exams)
    services.db
      .prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)')
      .run(DEMO_SEED_KEY, new Date().toISOString())
  })()
}

function isSeeded(services: AppServices): boolean {
  const row = services.db
    .prepare('SELECT value FROM meta WHERE key = ?')
    .get(DEMO_SEED_KEY) as { value: string } | undefined
  return Boolean(row?.value)
}

function readDemoExams(path: string): DemoExam[] {
  const markdown = readFileSync(path, 'utf8')
  const blocks = [...markdown.matchAll(/<!-- demo-exam\s*([\s\S]*?)-->\s*([\s\S]*?)(?=<!-- demo-exam|$)/g)]
  return blocks.map((block) => {
    const meta = JSON.parse(block[1].trim()) as DemoExamMeta
    return {
      ...meta,
      body: block[2].trim()
    }
  })
}

function seedDemoExams(services: AppServices, exams: DemoExam[]): void {
  const folderIds = new Map<string, string>()

  for (const exam of exams) {
    const folderId = getOrCreateFolderId(services, folderIds, exam.folder)
    const userId = services.getCurrentUser().id
    const examId = newId()
    const revisionId = newId()
    const submissionId = newId()
    const correctionId = newId()
    const submittedAt = normalizeIso(exam.submittedAt)
    const correctedAt = normalizeIso(exam.correctedAt)
    const content = markdownToTiptap(exam.title, exam.body)
    const contentHash = hashJson(content)
    const createdAt = offsetIso(submittedAt, -2)

    services.db
      .prepare(
        `
        INSERT INTO exams
          (id, user_id, title, folder_id, status, tags_json, notes, current_revision_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        examId,
        userId,
        exam.title,
        folderId,
        'corrected',
        stringifyJson(exam.tags),
        'Demo-Datensatz für Screenshots',
        revisionId,
        createdAt,
        correctedAt
      )

    services.db
      .prepare(
        `
        INSERT INTO exam_revisions
          (id, user_id, exam_id, created_at, kind, content_format, content_hash, content_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(revisionId, userId, examId, submittedAt, 'submission', 'tiptap-v1', contentHash, stringifyJson(content))

    services.db
      .prepare(
        `
        INSERT INTO submissions
          (id, user_id, exam_id, submitted_at, revision_id, content_hash, pdf_path)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(submissionId, userId, examId, submittedAt, revisionId, contentHash, null)

    services.db
      .prepare(
        `
        INSERT INTO corrections
          (id, user_id, submission_id, created_at, updated_at, score_points, grading_comment, tags_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(correctionId, userId, submissionId, correctedAt, correctedAt, exam.score, exam.gradingComment, stringifyJson(exam.tags))

    for (const comment of exam.comments) {
      seedInlineComment(services, {
        correctionId,
        userId,
        submissionId,
        createdAt: correctedAt,
        contentHash,
        fullText: `${exam.title}\n${exam.body}`,
        selectedText: comment.selectedText,
        body: comment.body,
        tags: exam.tags
      })
    }
  }
}

function getOrCreateFolderId(
  services: AppServices,
  folderIds: Map<string, string>,
  folderName: string
): string {
  const existing = folderIds.get(folderName)
  if (existing) return existing

  const folder = services.createFolder(folderName)
  folderIds.set(folderName, folder.id)
  return folder.id
}

function seedInlineComment(
  services: AppServices,
  input: {
    correctionId: string
    userId: string
    submissionId: string
    createdAt: string
    contentHash: string
    fullText: string
    selectedText: string
    body: string
    tags: string[]
  }
): void {
  const from = Math.max(0, input.fullText.indexOf(input.selectedText))
  const to = from + input.selectedText.length
  const anchor = {
    type: 'prosemirror-selection',
    editorSchemaVersion: EDITOR_SCHEMA_VERSION,
    from,
    to,
    selectedText: input.selectedText,
    prefix: input.fullText.slice(Math.max(0, from - 40), from),
    suffix: input.fullText.slice(to, to + 40),
    contentHash: input.contentHash
  }

  services.db
    .prepare(
      `
      INSERT INTO inline_comments
        (id, user_id, correction_id, submission_id, created_at, status, body, anchor_json, tags_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
    .run(
      newId(),
      input.userId,
      input.correctionId,
      input.submissionId,
      input.createdAt,
      'open',
      input.body,
      stringifyJson(anchor),
      stringifyJson(input.tags)
    )
}

function markdownToTiptap(title: string, markdown: string): Record<string, unknown> {
  const paragraphs = [title, ...markdown.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean)]
  return {
    type: 'doc',
    content: paragraphs.map((paragraph) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: paragraph.replace(/\s+/g, ' ') }]
    }))
  }
}

function offsetIso(value: string, days: number): string {
  const date = new Date(value)
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function normalizeIso(value: string): string {
  return new Date(value).toISOString()
}
