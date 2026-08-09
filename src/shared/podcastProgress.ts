import type { PodcastCatalog } from './schemas'

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
