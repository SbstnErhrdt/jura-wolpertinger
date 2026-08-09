import type { PodcastCatalog, PodcastLegalArea } from '../schemas'
import { BAYBO_PODCAST_CATALOG } from './baybo-april-2026'
import { POLIZEI_SICHERHEITSRECHT_PODCAST_CATALOG } from './polizei-und-sicherheitsrecht-august-2026'
import { STRAFRECHT_UEBERSICHTSSAMMLUNG_PODCAST_CATALOG } from './strafrecht-uebersichtssammlung-august-2026'
import { STEUERRECHT_AO_PODCAST_CATALOG } from './steuerrecht-ao-august-2026'

function mergePodcastCatalogs(catalogs: PodcastCatalog[]): PodcastCatalog {
  const areas = new Map<string, PodcastLegalArea>()

  for (const catalog of catalogs) {
    for (const area of catalog.legalAreas) {
      const existing = areas.get(area.slug)
      if (!existing) {
        areas.set(area.slug, { ...area, series: [...area.series] })
        continue
      }
      existing.series.push(...area.series)
    }
  }

  return { legalAreas: [...areas.values()] }
}

export const PODCAST_CATALOG = mergePodcastCatalogs([
  BAYBO_PODCAST_CATALOG,
  POLIZEI_SICHERHEITSRECHT_PODCAST_CATALOG,
  STEUERRECHT_AO_PODCAST_CATALOG,
  STRAFRECHT_UEBERSICHTSSAMMLUNG_PODCAST_CATALOG
])
