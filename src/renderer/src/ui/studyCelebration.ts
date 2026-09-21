import type { StudyCommand, StudyResponse } from '@shared/flashcardStudy'
import { z } from 'zod'

export type StudyCelebration = { count: number; title: string; copy: string; imageUrl: string }
export type CelebrationResult = { count: number; milestone: StudyCelebration | null; completion: StudyCelebration | null }
type CelebrationStorage = Pick<Storage, 'getItem' | 'setItem'>

const stateSchema = z.object({
  cards: z.record(z.string()),
  celebrated: z.number().int().nonnegative(),
  completionImage: z.number().int().min(1).max(39).nullable()
})
const encouragements = ['Schön, dass du dranbleibst.', 'Karte für Karte geht es voran.', 'Du hast dir Zeit fürs Lernen genommen.']

export function createStudyCelebration(storage: CelebrationStorage = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value)
}) {
  const fallback = new Map<string, string>()
  function read(key: string): unknown {
    try { return JSON.parse(fallback.get(key) ?? storage.getItem(key) ?? 'null') }
    catch { try { return JSON.parse(fallback.get(key) ?? 'null') } catch { return null } }
  }
  function write(key: string, value: unknown): void {
    const encoded = JSON.stringify(value)
    fallback.set(key, encoded)
    try { storage.setItem(key, encoded) } catch { /* Motivation must never block a saved review. */ }
  }
  function nextImage(userId: string): number {
    const key = `wolpi:celebration:v1:${encodeURIComponent(userId)}:image`
    const previous = z.number().int().min(1).max(39).safeParse(read(key))
    const image = previous.success ? previous.data % 39 + 1 : 1
    write(key, image)
    return image
  }
  function message(count: number, image: number, complete: boolean): StudyCelebration {
    return { count, title: 'Super gemacht!',
      copy: complete ? 'Du bist drangeblieben.' : encouragements[(image - 1) % encouragements.length],
      imageUrl: `assets/wolpi/wolpi-${String(image).padStart(2, '0')}.webp` }
  }

  return { apply(userId: string, command: StudyCommand, response: StudyResponse): CelebrationResult {
    const result: CelebrationResult = { count: 0, milestone: null, completion: null }
    const run = response.run
    if (!userId || !run || ('runId' in command && command.runId !== run.id)) return result
    const key = `wolpi:celebration:v1:${encodeURIComponent(userId)}:run:${encodeURIComponent(run.id)}`
    const saved = stateSchema.safeParse(read(key))
    const state = saved.success ? saved.data : { cards: {}, celebrated: 0, completionImage: null }
    let newlyRated = false
    if (command.action === 'rate') {
      const event = response.review?.event
      if (event && !event.voidedAt && event.userId === userId && event.id === command.eventId && event.cardId === command.cardId
        && !Object.hasOwn(state.cards, event.cardId) && !Object.values(state.cards).includes(event.id)) {
        state.cards[event.cardId] = event.id
        newlyRated = true
      }
    } else if (command.action === 'undo') {
      for (const [cardId, eventId] of Object.entries(state.cards)) {
        if (eventId === command.eventId) delete state.cards[cardId]
      }
    }
    result.count = Object.keys(state.cards).length
    const complete = run.status === 'completed' && run.total > 0 && run.completed > 0
    const threshold = Math.floor(result.count / 10)
    if (newlyRated && threshold > state.celebrated) {
      state.celebrated = threshold
      if (!complete) result.milestone = message(result.count, nextImage(userId), false)
    }
    if (complete) {
      state.completionImage ??= nextImage(userId)
      result.completion = message(run.completed, state.completionImage, true)
    }
    write(key, state)
    return result
  } }
}
