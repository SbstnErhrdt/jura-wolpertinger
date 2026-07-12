import { describe, expect, it } from 'vitest'
import type { ExamRevision } from '../../src/shared/schemas'
import { selectExamRevisionIdsForDeletion } from '../../src/shared/revisionRetention'

const userId = '11111111-1111-4111-8111-111111111111'
const examId = '22222222-2222-4222-8222-222222222222'
const now = '2026-07-12T12:00:00.000Z'

describe('exam revision retention', () => {
  it('keeps protected revisions and deletes only autosaves outside the retention windows', () => {
    const oldAutosaves = Array.from({ length: 25 }, (_, index) =>
      revision(`old-${index}`, `2026-05-${String(index + 1).padStart(2, '0')}T08:00:00.000Z`, 'autosave')
    )
    const initial = revision('initial', '2026-04-01T08:00:00.000Z', 'initial')
    const manual = revision('manual', '2026-04-02T08:00:00.000Z', 'manual')
    const submission = revision('submission-kind', '2026-04-03T08:00:00.000Z', 'submission')

    const deleted = selectExamRevisionIdsForDeletion({
      revisions: [...oldAutosaves, initial, manual, submission],
      currentRevisionId: oldAutosaves[0].id,
      submittedRevisionIds: new Set([oldAutosaves[1].id]),
      now
    })

    expect(deleted).toEqual(new Set([oldAutosaves[2].id, oldAutosaves[3].id, oldAutosaves[4].id]))
  })

  it('keeps one autosave per recent hour and one per recent day after the newest autosaves', () => {
    const alwaysKept = Array.from({ length: 20 }, (_, index) =>
      revision(`newest-${index}`, `2026-07-12T11:${String(59 - index).padStart(2, '0')}:00.000Z`, 'autosave')
    )
    const sameHour = [
      revision('hour-kept', '2026-07-12T09:50:00.000Z', 'autosave'),
      revision('hour-deleted-1', '2026-07-12T09:40:00.000Z', 'autosave'),
      revision('hour-deleted-2', '2026-07-12T09:30:00.000Z', 'autosave')
    ]
    const sameDay = [
      revision('day-kept', '2026-07-05T17:00:00.000Z', 'autosave'),
      revision('day-deleted-1', '2026-07-05T12:00:00.000Z', 'autosave'),
      revision('day-deleted-2', '2026-07-05T08:00:00.000Z', 'autosave')
    ]

    const deleted = selectExamRevisionIdsForDeletion({
      revisions: [...alwaysKept, ...sameHour, ...sameDay],
      currentRevisionId: null,
      submittedRevisionIds: new Set(),
      now
    })

    expect(deleted).toEqual(new Set([
      sameHour[1].id,
      sameHour[2].id,
      sameDay[1].id,
      sameDay[2].id
    ]))
  })
})

function revision(
  idSuffix: string,
  createdAt: string,
  kind: ExamRevision['kind']
): ExamRevision {
  return {
    schemaVersion: 1,
    editorSchemaVersion: 1,
    id: uuidFromSuffix(idSuffix),
    userId,
    examId,
    createdAt,
    kind,
    contentFormat: 'tiptap-v1',
    contentHash: `hash-${idSuffix}`,
    content: { type: 'doc', content: [] }
  }
}

function uuidFromSuffix(value: string): string {
  let hash = 0
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return `33333333-3333-4333-8333-${String(hash).padStart(12, '0').slice(0, 12)}`
}
