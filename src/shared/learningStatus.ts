import { z } from 'zod'
import type { ReviewCard } from './schemas'

export const learningStatusCountsSchema = z.object({
  notKnown: z.number().int().nonnegative(),
  partiallyKnown: z.number().int().nonnegative(),
  known: z.number().int().nonnegative()
})

export type LearningStatusCounts = z.infer<typeof learningStatusCountsSchema>
export type LearningStatusKey = 'not-known' | 'partially-known' | 'known' | 'unreviewed'
export type LearningStatusSegment = {
  key: LearningStatusKey
  label: string
  count: number
  percentage: number
}

export function countLearningStatuses(
  cards: ReadonlyArray<Pick<ReviewCard, 'lastRating'>>
): LearningStatusCounts {
  return cards.reduce<LearningStatusCounts>((counts, card) => {
    if (card.lastRating === 1) counts.notKnown += 1
    else if (card.lastRating === 2) counts.partiallyKnown += 1
    else if (card.lastRating === 3 || card.lastRating === 4) counts.known += 1
    return counts
  }, { notKnown: 0, partiallyKnown: 0, known: 0 })
}

export function learningStatusSegments(
  total: number,
  counts: LearningStatusCounts
): LearningStatusSegment[] {
  const safeTotal = Math.max(0, Math.floor(total))
  let remaining = safeTotal
  const take = (value: number): number => {
    const count = Math.min(remaining, Math.max(0, Math.floor(value)))
    remaining -= count
    return count
  }
  const values = [
    { key: 'not-known' as const, label: 'Nicht gewusst', count: take(counts.notKnown) },
    { key: 'partially-known' as const, label: 'Teilweise gewusst', count: take(counts.partiallyKnown) },
    { key: 'known' as const, label: 'Gewusst', count: take(counts.known) },
    { key: 'unreviewed' as const, label: 'Noch nicht bearbeitet', count: remaining }
  ]
  return values.map((segment) => ({
    ...segment,
    percentage: safeTotal ? (segment.count / safeTotal) * 100 : 0
  }))
}
