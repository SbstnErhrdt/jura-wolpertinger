import { describe, expect, it } from 'vitest'
import { mergeCloudExamDateImports } from '../../src/renderer/src/cloudExamDateImports'

const userId = '11111111-1111-4111-8111-111111111111'
const examId = '44444444-4444-4444-8444-444444444444'
const previousCreatedAt = '2026-09-20T12:00:00.000Z'
const createdAt = '2025-06-03T08:00:00.000Z'
const marker = { schemaVersion: 1, revision: 1, userId, examId, previousCreatedAt, createdAt }

function fixture() {
  const local = { exams: [{
    id: examId, userId, createdAt: previousCreatedAt, title: 'Mein Titel', notes: 'Meine Notiz',
    tags: ['Eigener Tag'], status: 'archived', updatedAt: previousCreatedAt,
    currentRevisionId: 'mein-entwurf'
  } as Record<string, unknown>], revisions: ['Mein unveränderter Text'] }
  const remote = { exams: [{
    ...local.exams[0], id: examId, userId, createdAt, title: 'Alter Titel', notes: 'Alte Notiz', tags: [],
    status: 'in_progress', currentRevisionId: 'alter-entwurf', dateImport: { ...marker }
  }], revisions: ['Alter Text'] }
  return { local, remote }
}

describe('cloud exam date imports', () => {
  it('adopts only an explicitly marked historical date without replacing local work', () => {
    const { local, remote } = fixture()
    const original = structuredClone(local)
    expect(mergeCloudExamDateImports(local, remote, userId)).toEqual({
      ...local, exams: [{ ...local.exams[0], createdAt, dateImport: marker }]
    })
    expect(local).toEqual(original)
    delete (remote.exams[0] as Record<string, unknown>).dateImport
    expect(mergeCloudExamDateImports(local, remote, userId)).toEqual(local)
  })

  it('acknowledges an already correct date and equivalent ISO timezone representations', () => {
    for (const date of [createdAt, '2026-09-20T14:00:00.000+02:00']) {
      const { local, remote } = fixture()
      local.exams[0].createdAt = date
      expect(mergeCloudExamDateImports(local, remote, userId).exams[0]).toMatchObject({ createdAt, dateImport: marker })
    }
  })

  it('keeps subsequent deliberate edits after acknowledging this revision, including upload', () => {
    const { local, remote } = fixture()
    const applied = mergeCloudExamDateImports(local, remote, userId)
    expect(applied.exams[0]).toMatchObject({ createdAt, dateImport: marker })
    applied.exams[0].createdAt = '2025-06-04T08:00:00.000Z'
    expect(mergeCloudExamDateImports(applied, remote, userId, true)).toEqual(applied)
    // After that edit is uploaded, the marker is still a receipt, not a new command.
    expect(mergeCloudExamDateImports(applied, applied, userId, true)).toEqual(applied)
    // A browser without the receipt cannot adopt that now-inconsistent command.
    expect(() => mergeCloudExamDateImports(local, applied, userId, true)).toThrow()
  })

  it('accepts a newer revision once and ignores a stale revision afterward', () => {
    const { local, remote } = fixture()
    const applied = mergeCloudExamDateImports(local, remote, userId)
    const newer = structuredClone(remote)
    const corrected = '2025-06-02T08:00:00.000Z'
    Object.assign(newer.exams[0], { createdAt: corrected, dateImport: { ...marker, revision: 2, previousCreatedAt: createdAt, createdAt: corrected } })
    const reapplied = mergeCloudExamDateImports(applied, newer, userId, true)
    expect(reapplied.exams[0]).toMatchObject({ createdAt: corrected, dateImport: { revision: 2 } })
    expect(mergeCloudExamDateImports(reapplied, remote, userId, true)).toEqual(reapplied)
  })

  it.each([
    'schema', 'revision', 'invalid date', 'date without time', 'impossible date', 'invalid previous date',
    'null marker', 'null local marker', 'invalid offset',
    'foreign marker user', 'foreign marker exam', 'foreign row', 'foreign local row',
    'mismatched target', 'unknown local marker', 'conflicting same revision',
    'duplicate remote exam', 'duplicate local exam', 'locally changed date'
  ])('preserves local work and prevents unsafe upload for %s', kind => {
    const { local, remote } = fixture()
    const imported = remote.exams[0].dateImport
    if (kind === 'schema') imported.schemaVersion = 99
    if (kind === 'revision') imported.revision = 0
    if (kind === 'invalid date') imported.createdAt = 'tomorrow'
    if (kind === 'date without time') imported.createdAt = '2025-06-03'
    if (kind === 'impossible date') imported.createdAt = '2025-02-30T08:00:00.000Z'
    if (kind === 'invalid previous date') imported.previousCreatedAt = 'bad'
    if (kind === 'null marker') Object.assign(remote.exams[0], { dateImport: null })
    if (kind === 'null local marker') local.exams[0].dateImport = null
    if (kind === 'invalid offset') {
      imported.previousCreatedAt = '2026-09-20T12:00:00.000+99:00'
      local.exams[0].createdAt = createdAt
    }
    if (kind === 'foreign marker user') imported.userId = examId
    if (kind === 'foreign marker exam') imported.examId = userId
    if (kind === 'foreign row') remote.exams[0].userId = examId
    if (kind === 'foreign local row') local.exams[0].userId = examId
    if (kind === 'mismatched target') remote.exams[0].createdAt = previousCreatedAt
    if (kind === 'unknown local marker') local.exams[0].dateImport = { schemaVersion: 99 }
    if (kind === 'conflicting same revision') local.exams[0].dateImport = { ...marker, previousCreatedAt: '2026-09-19T08:00:00.000Z' }
    if (kind === 'duplicate remote exam') remote.exams.push(structuredClone(remote.exams[0]))
    if (kind === 'duplicate local exam') local.exams.push(structuredClone(local.exams[0]))
    if (kind === 'locally changed date') local.exams[0].createdAt = '2025-06-04T08:00:00.000Z'
    expect(mergeCloudExamDateImports(local, remote, userId)).toEqual(local)
    expect(() => mergeCloudExamDateImports(local, remote, userId, true)).toThrow('Die Online-Sicherung bleibt unverändert')
  })

  it('does not treat a prior receipt as permission to replace a later deliberate date edit', () => {
    const { local, remote } = fixture()
    local.exams[0].dateImport = { ...marker, revision: 1 }
    local.exams[0].createdAt = '2025-06-04T08:00:00.000Z'
    remote.exams[0].dateImport.revision = 2
    remote.exams[0].dateImport.previousCreatedAt = createdAt
    expect(mergeCloudExamDateImports(local, remote, userId)).toEqual(local)
    expect(() => mergeCloudExamDateImports(local, remote, userId, true)).toThrow()
  })

  it('validates markers on new exams before the caller copies their complete tree on upload', () => {
    const { remote } = fixture()
    const local = { exams: [], revisions: [] }
    expect(mergeCloudExamDateImports(local, remote, userId, true)).toEqual(local)
    remote.exams[0].dateImport.userId = examId
    expect(() => mergeCloudExamDateImports(local, remote, userId, true)).toThrow()
  })
})
