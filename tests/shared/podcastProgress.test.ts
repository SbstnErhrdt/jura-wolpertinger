import { describe, expect, it } from 'vitest'
import type { PodcastEpisode } from '../../src/shared/schemas'
import { calculatePodcastSeriesProgress } from '../../src/shared/podcastProgress'

const SERIES_ID = 'ba7b2026-0400-4000-8000-000000000001'

function episode(
  id: string,
  durationSeconds: number,
  positionSeconds: number | null,
  completed = false
): PodcastEpisode {
  return {
    id,
    seriesId: SERIES_ID,
    slug: `folge-${id.slice(-1)}`,
    number: Number(id.slice(-1)),
    title: `Folge ${id.slice(-1)}`,
    description: '',
    durationSeconds,
    audioUrl: `https://example.com/${id}.mp3`,
    publishedAt: '2026-09-20T00:00:00.000Z',
    progress:
      positionSeconds === null
        ? null
        : {
            episodeId: id,
            positionSeconds,
            durationSeconds,
            completed,
            lastPlayedAt: '2026-09-20T12:00:00.000Z',
            updatedAt: '2026-09-20T12:00:00.000Z'
          }
  }
}

describe('podcast series progress', () => {
  it('returns an empty zero-percent result', () => {
    expect(calculatePodcastSeriesProgress([])).toEqual({
      completedEpisodes: 0,
      totalEpisodes: 0,
      listenedSeconds: 0,
      durationSeconds: 0,
      percentage: 0
    })
  })

  it('uses the listened position for an unfinished episode', () => {
    expect(
      calculatePodcastSeriesProgress([
        episode('00000000-0000-4000-8000-000000000001', 100, 50)
      ])
    ).toEqual({
      completedEpisodes: 0,
      totalEpisodes: 1,
      listenedSeconds: 50,
      durationSeconds: 100,
      percentage: 50
    })
  })

  it('weights completed and partially heard episodes by duration', () => {
    expect(
      calculatePodcastSeriesProgress([
        episode('00000000-0000-4000-8000-000000000001', 100, 95, true),
        episode('00000000-0000-4000-8000-000000000002', 100, 25)
      ])
    ).toEqual({
      completedEpisodes: 1,
      totalEpisodes: 2,
      listenedSeconds: 125,
      durationSeconds: 200,
      percentage: 63
    })
  })

  it('clamps an unfinished position to the catalog duration', () => {
    expect(
      calculatePodcastSeriesProgress([
        episode('00000000-0000-4000-8000-000000000001', 80, 120)
      ])
    ).toMatchObject({ listenedSeconds: 80, durationSeconds: 80, percentage: 100 })
  })

  it('does not divide by zero for episodes without a duration', () => {
    expect(
      calculatePodcastSeriesProgress([
        episode('00000000-0000-4000-8000-000000000001', 0, 20)
      ])
    ).toEqual({
      completedEpisodes: 0,
      totalEpisodes: 1,
      listenedSeconds: 0,
      durationSeconds: 0,
      percentage: 0
    })
  })
})
