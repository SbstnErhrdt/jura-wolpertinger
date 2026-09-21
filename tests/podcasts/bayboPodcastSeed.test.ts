import { describe, expect, it } from 'vitest'
import { BAYBO_PODCAST_CATALOG } from '@shared/podcasts/baybo-april-2026'
import { buildBayboSeedPlan } from '../../scripts/podcasts/seed-baybo-podcast'

describe('BayBO podcast seed', () => {
  it('maps all generated episodes to stable catalog rows and existing MP3 files', () => {
    const plan = buildBayboSeedPlan(
      'output/learning-podcasts/baybo-april-2026',
      'https://app.jura-wolpi.de/api'
    )
    const catalogEpisodes = BAYBO_PODCAST_CATALOG.legalAreas[0].series[0].episodes

    expect(plan.episodes).toHaveLength(18)
    expect(plan.uploads).toHaveLength(18)
    expect(plan.series.id).toBe('ba7b2026-0400-4000-8000-000000000001')
    expect(plan.episodes.map((episode) => episode.id)).toEqual(
      catalogEpisodes.map((episode) => episode.id)
    )
    expect(plan.episodes.map((episode) => Number(episode.duration_seconds))).toEqual(
      catalogEpisodes.map((episode) => episode.durationSeconds)
    )
    expect(plan.uploads.every((upload) => upload.size > 0)).toBe(true)
    expect(plan.uploads.map((upload) => upload.storagePath)).toEqual(
      plan.episodes.map((episode) => episode.storage_path)
    )
    expect(plan.episodes[0].audio_url).toBe(
      'https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio/' +
        'baybo-april-2026/01-regelungsgegenstand-und-grundbegriffe.mp3'
    )
  })
})
