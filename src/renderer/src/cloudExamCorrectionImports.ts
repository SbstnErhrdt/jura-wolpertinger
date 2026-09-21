import { z } from 'zod'
import {
  attachmentSchema, correctionSchema, examStatusSchema, inlineCommentSchema,
  revisionSchema, submissionSchema, uuidSchema,
  type Attachment, type Correction, type ExamRevision, type InlineComment, type Submission
} from '@shared/schemas'

const correctionImportSchema = z.object({
  schemaVersion: z.literal(1),
  revision: z.number().int().positive().safe(),
  submissionIds: z.array(uuidSchema),
  attachmentIds: z.array(uuidSchema),
  previousStatus: examStatusSchema,
  currentRevisionId: uuidSchema.nullable()
})

type ImportStore = {
  exams: Array<Record<string, unknown>>
  revisions: ExamRevision[]
  submissions: Submission[]
  corrections: Correction[]
  attachments: Attachment[]
  inlineComments?: InlineComment[]
}

// An import is append-only and acknowledged atomically per exam. An incompatible
// immutable ID or an invalid dependency leaves the whole import unapplied.
export function mergeCloudExamCorrectionImports<T extends ImportStore>(local: T, remote: T, userId: string, rejectUnappliedImport = false): T {
  let result = local
  for (const exam of local.exams) {
    if (exam.userId !== userId) continue
    const incoming = uniqueRow(remote.exams, exam.id)
    if (incoming?.userId !== userId) continue
    const imported = correctionImportSchema.safeParse(incoming.correctionImport)
    const applied = correctionImportSchema.safeParse(exam.correctionImport)
    if (!imported.success || (exam.correctionImport != null && !applied.success)) continue
    if (applied.success && applied.data.revision >= imported.data.revision) continue
    const marker = imported.data
    const revisions: ExamRevision[] = []
    const submissions: Submission[] = []
    const corrections: Correction[] = []
    const comments: InlineComment[] = []
    const attachments: Attachment[] = []
    let valid = true
    for (const id of new Set(marker.submissionIds)) {
      const submission = submissionSchema.safeParse(uniqueRow(remote.submissions, id))
      if (!submission.success || submission.data.userId !== userId || submission.data.examId !== exam.id) { valid = false; break }
      const row = submission.data
      const revision = revisionSchema.safeParse(uniqueRow(remote.revisions, row.revisionId))
      if (!revision.success || revision.data.userId !== userId || revision.data.examId !== exam.id || revision.data.contentHash !== row.contentHash) { valid = false; break }
      if (!compatibleImmutable(result.revisions, revision.data) || !compatibleImmutable(result.submissions, row)) { valid = false; break }
      revisions.push(revision.data)
      submissions.push(row)
      for (const raw of remote.corrections.filter(item => item?.targetSubmissionId === id)) {
        // Browser edits own the nested list, including an empty list after
        // deletion. Only legacy rows without that field use flattened comments.
        const parsed = correctionSchema.safeParse({
          ...raw,
          inlineComments: raw.inlineComments === undefined
            ? (remote.inlineComments ?? []).filter(item => item?.correctionId === raw.id)
            : raw.inlineComments
        })
        if (!parsed.success || parsed.data.userId !== userId || !uniqueRow(remote.corrections, parsed.data.id)) { valid = false; break }
        const correction = parsed.data
        const byId = new Map<string, InlineComment>()
        for (const rawComment of correction.inlineComments) {
          const parsedComment = inlineCommentSchema.safeParse(rawComment)
          if (!parsedComment.success) { valid = false; break }
          const comment = parsedComment.data
          if (comment.userId !== userId || comment.correctionId !== correction.id || comment.targetSubmissionId !== id || comment.anchor.contentHash !== row.contentHash || comment.anchor.to < comment.anchor.from) { valid = false; break }
          if (byId.has(comment.id) && !sameRow(byId.get(comment.id), comment)) { valid = false; break }
          byId.set(comment.id, comment)
        }
        if (!valid) break
        const existing = result.corrections.filter(item => item.id === correction.id)
        if (existing.length > 1 || existing.some(item => item.userId !== userId || item.targetSubmissionId !== id)) { valid = false; break }
        // Existing corrections and their comments are editable. Preserve them,
        // including deliberate comment removals, even on a later import revision.
        if (existing.length) continue
        for (const comment of byId.values()) {
          const present = (result.inlineComments ?? []).filter(item => item.id === comment.id)
          if (present.length > 1 || present.some(item => item.userId !== userId || item.correctionId !== correction.id || item.targetSubmissionId !== id)) { valid = false; break }
          if (!compatibleImmutable(comments, comment)) { valid = false; break }
          byId.set(comment.id, present[0] ?? comment)
        }
        if (!valid) break
        correction.inlineComments = [...byId.values()]
        corrections.push(correction)
        comments.push(...correction.inlineComments)
      }
      if (!valid) break
    }
    for (const id of new Set(marker.attachmentIds)) {
      const parsed = attachmentSchema.safeParse(uniqueRow(remote.attachments, id))
      if (!parsed.success || parsed.data.userId !== userId || parsed.data.examId !== exam.id || !compatibleImmutable(result.attachments, parsed.data)) { valid = false; break }
      attachments.push(parsed.data)
    }
    if (!valid) continue
    const canAdoptStatus = exam.status !== 'archived' && !exam.trashedAt && exam.status === marker.previousStatus
      && exam.currentRevisionId === marker.currentRevisionId && incoming.currentRevisionId === marker.currentRevisionId
      && (incoming.status === 'submitted' || incoming.status === 'corrected') && submissions.length > 0
      && (incoming.status !== 'corrected' || corrections.length > 0 || result.corrections.some(row => marker.submissionIds.includes(row.targetSubmissionId)))
    result = {
      ...result,
      exams: result.exams.map(row => row === exam ? { ...exam, ...(canAdoptStatus ? { status: incoming.status } : {}), correctionImport: marker } : row),
      revisions: appendMissing(result.revisions, revisions),
      submissions: appendMissing(result.submissions, submissions),
      corrections: appendMissing(result.corrections, corrections),
      inlineComments: appendMissing(result.inlineComments ?? [], comments),
      attachments: appendMissing(result.attachments, attachments)
    }
  }
  if (rejectUnappliedImport) {
    for (const incoming of remote.exams) {
      if (incoming?.correctionImport == null) continue
      const exam = result.exams.find(row => row.id === incoming.id)
      if (!exam) continue // New exams are copied with their complete tree by the caller.
      const imported = correctionImportSchema.safeParse(incoming.correctionImport)
      const applied = correctionImportSchema.safeParse(exam.correctionImport)
      if (incoming.userId !== userId || exam.userId !== userId || !imported.success || !applied.success
        || applied.data.revision < imported.data.revision) {
        throw new Error('Frühere Abgaben konnten nicht vollständig übernommen werden. Die Online-Sicherung bleibt unverändert; dein Entwurf ist auf diesem Gerät gespeichert.')
      }
    }
  }
  return result
}

function uniqueRow<T extends { id?: unknown }>(rows: T[], id: unknown): T | undefined {
  const matches = rows.filter(row => row?.id === id)
  return matches.length === 1 ? matches[0] : undefined
}

function sameRow(left: unknown, right: unknown): boolean {
  // Ignore object key order, but keep every field and array position significant.
  const ordered = (value: unknown): unknown => Array.isArray(value) ? value.map(ordered)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, ordered(item)])) : value
  return JSON.stringify(ordered(left)) === JSON.stringify(ordered(right))
}

function compatibleImmutable<T extends { id: string }>(rows: T[], incoming: T): boolean {
  const matches = rows.filter(row => row.id === incoming.id)
  return matches.length === 0 || (matches.length === 1 && sameRow(matches[0], incoming))
}

function appendMissing<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const ids = new Set(existing.map(row => row.id))
  return [...existing, ...incoming.filter(row => {
    if (ids.has(row.id)) return false
    ids.add(row.id)
    return true
  })]
}
