import { describe, expect, it } from 'vitest'
import { countLearningStatuses, learningStatusSegments } from '../../src/shared/learningStatus'

describe('learning status groups', () => {
  it('groups the latest ratings into three understandable states', () => {
    expect(countLearningStatuses([
      { lastRating: 1 },
      { lastRating: 2 },
      { lastRating: 3 },
      { lastRating: 4 },
      { lastRating: null }
    ])).toEqual({ notKnown: 1, partiallyKnown: 1, known: 2 })
  })

  it('derives an unreviewed remainder without allowing invalid widths', () => {
    expect(learningStatusSegments(5, { notKnown: 1, partiallyKnown: 1, known: 2 })).toEqual([
      { key: 'not-known', label: 'Nicht gewusst', count: 1, percentage: 20 },
      { key: 'partially-known', label: 'Teilweise gewusst', count: 1, percentage: 20 },
      { key: 'known', label: 'Gewusst', count: 2, percentage: 40 },
      { key: 'unreviewed', label: 'Noch nicht bearbeitet', count: 1, percentage: 20 }
    ])
    expect(learningStatusSegments(0, { notKnown: 4, partiallyKnown: 2, known: 8 }))
      .toEqual([
        { key: 'not-known', label: 'Nicht gewusst', count: 0, percentage: 0 },
        { key: 'partially-known', label: 'Teilweise gewusst', count: 0, percentage: 0 },
        { key: 'known', label: 'Gewusst', count: 0, percentage: 0 },
        { key: 'unreviewed', label: 'Noch nicht bearbeitet', count: 0, percentage: 0 }
      ])
  })
})
