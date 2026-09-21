import type { PodcastCatalog, PodcastSeries } from '@shared/schemas'

function normalizeSearchValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('de-DE')
    .trim()
}

function seriesMatches(series: PodcastSeries, query: string): boolean {
  const values = [
    series.title,
    series.description,
    series.edition ?? '',
    ...series.episodes.flatMap((episode) => [episode.title, episode.description])
  ]
  return values.some((value) => normalizeSearchValue(value).includes(query))
}

export function filterPodcastCatalog(catalog: PodcastCatalog, query: string): PodcastCatalog {
  const normalizedQuery = normalizeSearchValue(query)
  if (!normalizedQuery) return catalog

  return {
    legalAreas: catalog.legalAreas.flatMap((legalArea) => {
      const areaMatches = normalizeSearchValue(legalArea.name).includes(normalizedQuery)
      const series = areaMatches
        ? legalArea.series
        : legalArea.series.filter((entry) => seriesMatches(entry, normalizedQuery))
      return series.length ? [{ ...legalArea, series }] : []
    })
  }
}
