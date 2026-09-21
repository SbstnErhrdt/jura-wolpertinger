import { describe, expect, it } from 'vitest'
import {
  findPodcastSeriesSlug,
  isPodcastEpisodeComplete,
  savePodcastProgressWithoutInterrupting,
  shouldPersistPodcastProgress
} from '../../src/shared/podcastProgress'
import { BAYBO_PODCAST_CATALOG, BAYBO_PODCAST_SLUG } from '../../src/shared/podcasts/baybo-april-2026'

describe('podcast player progress', () => {
  it('marks episodes complete at 95 percent or with at most 30 seconds remaining', () => {
    expect(isPodcastEpisodeComplete(665, 700)).toBe(true)
    expect(isPodcastEpisodeComplete(670, 700)).toBe(true)
    expect(isPodcastEpisodeComplete(500, 700)).toBe(false)
  })

  it('throttles routine progress while allowing forced pause and completion saves', () => {
    expect(shouldPersistPodcastProgress(10_000, 13_000, false)).toBe(false)
    expect(shouldPersistPodcastProgress(10_000, 15_000, false)).toBe(true)
    expect(shouldPersistPodcastProgress(10_000, 10_100, true)).toBe(true)
  })

  it('derives the current series route from the global catalog', () => {
    const episodeId = BAYBO_PODCAST_CATALOG.legalAreas[0].series[0].episodes[0].id

    expect(findPodcastSeriesSlug(BAYBO_PODCAST_CATALOG, episodeId)).toBe(BAYBO_PODCAST_SLUG)
    expect(findPodcastSeriesSlug(BAYBO_PODCAST_CATALOG, crypto.randomUUID())).toBeNull()
  })

  it('does not interrupt playback when progress persistence is temporarily unavailable', async () => {
    await expect(
      savePodcastProgressWithoutInterrupting(async () => {
        throw new Error('offline')
      })
    ).resolves.toBeNull()
  })
})
