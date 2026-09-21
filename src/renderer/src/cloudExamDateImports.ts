import { z } from 'zod'

const isoDateTimeSchema = z.string().datetime({ offset: true }).refine(value => Number.isFinite(Date.parse(value)))
const dateImportSchema = z.object({
  schemaVersion: z.literal(1),
  revision: z.number().int().positive().safe(),
  userId: z.string().uuid(),
  examId: z.string().uuid(),
  previousCreatedAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema
}).strict()

type ImportStore = { exams: Array<Record<string, unknown>> }

// The marker doubles as the receipt. A new revision may change only the expected
// old date; an acknowledged revision must never undo a later deliberate edit.
export function mergeCloudExamDateImports<T extends ImportStore>(local: T, remote: T, userId: string, rejectUnappliedImport = false): T {
  let result = local
  const reject = (): void => {
    if (rejectUnappliedImport) {
      throw new Error('Das frühere Prüfungsdatum konnte nicht sicher übernommen werden. Die Online-Sicherung bleibt unverändert; dein Entwurf ist auf diesem Gerät gespeichert.')
    }
  }
  for (const incoming of remote.exams) {
    if (incoming?.dateImport === undefined) continue
    const imported = dateImportSchema.safeParse(incoming.dateImport)
    const matches = local.exams.filter(exam => exam.id === incoming.id)
    if (!imported.success || incoming.userId !== userId || imported.data.userId !== userId
      || imported.data.examId !== incoming.id || remote.exams.filter(exam => exam.id === incoming.id).length !== 1
      || matches.length > 1) {
      reject()
      continue
    }
    const marker = imported.data
    const exam = matches[0]
    if (exam) {
      const applied = dateImportSchema.safeParse(exam.dateImport)
      if (exam.userId !== userId || !isoDateTimeSchema.safeParse(exam.createdAt).success
        || (exam.dateImport !== undefined && (!applied.success || applied.data.userId !== userId || applied.data.examId !== exam.id))) {
        reject()
        continue
      }
      if (applied.success && applied.data.revision >= marker.revision) {
        // Equal revisions must name the same immutable import. A newer receipt
        // supersedes a stale cloud copy. Neither reapplies the old date.
        if (applied.data.revision === marker.revision && JSON.stringify(applied.data) !== JSON.stringify(marker)) reject()
        continue
      }
    }
    if (!sameDateTime(incoming.createdAt, marker.createdAt)
      || (exam && !sameDateTime(exam.createdAt, marker.previousCreatedAt) && !sameDateTime(exam.createdAt, marker.createdAt))) {
      // A different unacknowledged local date is a conflict, not consent to
      // discard the remote correction. Keep both copies by blocking upload.
      reject()
      continue
    }
    if (!exam) continue // The caller copies new exams with their complete tree.
    result = {
      ...result,
      exams: result.exams.map(row => row === exam ? { ...exam, createdAt: marker.createdAt, dateImport: marker } : row)
    }
  }
  return result
}

function sameDateTime(value: unknown, expected: string): boolean {
  const parsed = isoDateTimeSchema.safeParse(value)
  return parsed.success && Date.parse(parsed.data) === Date.parse(expected)
}
