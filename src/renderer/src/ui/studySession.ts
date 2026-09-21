import { ref, shallowRef } from 'vue'
import type { StudyCommand, StudyResponse, StudyRun } from '@shared/flashcardStudy'
import type { ReviewCard } from '@shared/schemas'

export function createStudySession(api: (input: StudyCommand) => Promise<StudyResponse>) {
  const cards = ref<ReviewCard[]>([])
  const run = ref<StudyRun | null>(null)
  const busy = ref(false)
  const error = ref('')
  const pending = ref<StudyCommand | null>(null)
  const ratings = ref<Array<{ eventId: string; rating: number }>>([])
  const lastReview = ref<{ eventId: string; card: ReviewCard } | null>(null)
  const applied = shallowRef<{ command: StudyCommand; response: StudyResponse } | null>(null)

  async function send(command: StudyCommand): Promise<boolean> {
    if (busy.value) return false
    busy.value = true
    error.value = ''
    pending.value = command
    const previousCard = cards.value.find((card) => 'cardId' in command && card.id === command.cardId)
    try {
      const result = await api(command)
      run.value = result.run
      cards.value = result.cards
      if (command.action === 'rate' && result.review) {
        if (!ratings.value.some((item) => item.eventId === command.eventId)) ratings.value.push({ eventId: command.eventId, rating: command.rating })
        if (previousCard) lastReview.value = { eventId: command.eventId, card: previousCard }
      }
      if (command.action === 'undo') {
        ratings.value = ratings.value.filter((item) => item.eventId !== command.eventId)
        lastReview.value = null
      }
      if (command.action === 'start') { ratings.value = []; lastReview.value = null }
      pending.value = null
      applied.value = { command, response: result }
      return true
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : typeof reason === 'object' && reason && 'message' in reason ? String(reason.message) : ''
      error.value = detail || 'Das Speichern hat nicht geklappt. Bitte versuche es erneut.'
      return false
    } finally {
      busy.value = false
    }
  }

  return { cards, run, busy, error, pending, ratings, lastReview, applied, send,
    retry: () => pending.value ? send(pending.value) : Promise.resolve(false) }
}
