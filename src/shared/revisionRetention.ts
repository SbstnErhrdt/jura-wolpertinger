import type { ExamRevision } from './schemas'

export type RevisionRetentionInput = {
  revisions: ExamRevision[]
  currentRevisionId: string | null
  submittedRevisionIds: Set<string>
  now?: string
}

const ALWAYS_KEEP_AUTOSAVES = 20
const HOURLY_KEEP_MS = 24 * 60 * 60 * 1000
const DAILY_KEEP_MS = 30 * 24 * 60 * 60 * 1000

export function selectExamRevisionIdsForDeletion(input: RevisionRetentionInput): Set<string> {
  const keep = new Set<string>()
  const deleteIds = new Set<string>()
  const nowMs = new Date(input.now ?? new Date().toISOString()).getTime()

  if (input.currentRevisionId) keep.add(input.currentRevisionId)
  for (const id of input.submittedRevisionIds) keep.add(id)

  for (const revision of input.revisions) {
    if (revision.kind !== 'autosave') keep.add(revision.id)
  }

  const autosaves = input.revisions
    .filter((revision) => revision.kind === 'autosave')
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))

  for (const revision of autosaves.slice(0, ALWAYS_KEEP_AUTOSAVES)) {
    keep.add(revision.id)
  }

  const keptHours = new Set<string>()
  const keptDays = new Set<string>()
  for (const revision of autosaves.slice(ALWAYS_KEEP_AUTOSAVES)) {
    if (keep.has(revision.id)) continue
    const createdMs = new Date(revision.createdAt).getTime()
    const ageMs = nowMs - createdMs

    if (ageMs >= 0 && ageMs <= HOURLY_KEEP_MS) {
      const hourKey = revision.createdAt.slice(0, 13)
      if (!keptHours.has(hourKey)) {
        keptHours.add(hourKey)
        keep.add(revision.id)
        continue
      }
    }

    if (ageMs > HOURLY_KEEP_MS && ageMs <= DAILY_KEEP_MS) {
      const dayKey = revision.createdAt.slice(0, 10)
      if (!keptDays.has(dayKey)) {
        keptDays.add(dayKey)
        keep.add(revision.id)
        continue
      }
    }
  }

  for (const revision of autosaves) {
    if (!keep.has(revision.id)) deleteIds.add(revision.id)
  }

  return deleteIds
}
