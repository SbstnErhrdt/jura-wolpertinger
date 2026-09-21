import type { PodcastCatalog, PodcastEpisode } from './schemas'

export type PodcastSeriesProgress = {
  completedEpisodes: number
  totalEpisodes: number
  listenedSeconds: number
  durationSeconds: number
  percentage: number
}

export function calculatePodcastSeriesProgress(
  episodes: PodcastEpisode[]
): PodcastSeriesProgress {
  const totals = episodes.reduce(
    (result, episode) => {
      const duration = Math.max(0, episode.durationSeconds)
      const position = episode.progress?.completed
        ? duration
        : Math.min(duration, Math.max(0, episode.progress?.positionSeconds ?? 0))

      result.durationSeconds += duration
      result.listenedSeconds += position
      if (episode.progress?.completed) result.completedEpisodes += 1
      return result
    },
    { completedEpisodes: 0, listenedSeconds: 0, durationSeconds: 0 }
  )

  return {
    ...totals,
    totalEpisodes: episodes.length,
    percentage:
      totals.durationSeconds > 0
        ? Math.round((totals.listenedSeconds / totals.durationSeconds) * 100)
        : 0
  }
}

export function isPodcastEpisodeComplete(
  positionSeconds: number,
  durationSeconds: number
): boolean {
  return (
    durationSeconds > 0 &&
    (positionSeconds / durationSeconds >= 0.95 || durationSeconds - positionSeconds <= 30)
  )
}

export function shouldPersistPodcastProgress(
  lastPersistedTimestamp: number,
  currentTimestamp: number,
  force: boolean
): boolean {
  return force || currentTimestamp - lastPersistedTimestamp >= 5_000
}

export function findPodcastSeriesSlug(
  catalog: PodcastCatalog,
  episodeId: string
): string | null {
  for (const legalArea of catalog.legalAreas) {
    const series = legalArea.series.find((candidate) =>
      candidate.episodes.some((episode) => episode.id === episodeId)
    )
    if (series) return series.slug
  }
  return null
}

export async function savePodcastProgressWithoutInterrupting<T>(
  save: () => Promise<T>
): Promise<T | null> {
  try {
    return await save()
  } catch {
    return null
  }
}
