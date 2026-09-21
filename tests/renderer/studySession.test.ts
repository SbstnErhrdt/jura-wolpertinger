import { expect, it } from 'vitest'
import type { StudyCommand, StudyResponse } from '../../src/shared/flashcardStudy'
const sessionPath = '../../src/renderer/src/ui/studySession'
const { createStudySession } = await import(/* @vite-ignore */ sessionPath)

it('retries an uncertain save with the same event ID and counts it once', async () => {
  const calls: StudyCommand[] = []
  let fail = true
  const session = createStudySession(async (command: StudyCommand) => {
    calls.push(command)
    if (fail) { fail = false; throw new Error('Verbindung unterbrochen') }
    return { overviews: [], cards: [], run: null, review: null } satisfies StudyResponse
  })
  await session.send({ action: 'rate', runId: 'run', cardId: 'card', rating: 1, eventId: 'stable-id' })
  expect(session.error.value).toContain('Verbindung')
  await session.retry()
  expect(calls).toEqual([calls[0], calls[0]])
  expect(session.error.value).toBe('')
})

it('keeps the displayed batch when saving fails instead of completing the run', async () => {
  const session = createStudySession(async () => { throw new Error('offline') })
  await session.send({ action: 'batch', runId: 'existing' })
  expect(session.error.value).toBeTruthy()
  expect(session.busy.value).toBe(false)
  expect(session.pending.value).toEqual({ action: 'batch', runId: 'existing' })
})
