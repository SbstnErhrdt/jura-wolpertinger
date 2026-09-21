import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PODCAST_CATALOG } from '@shared/podcasts/catalog'
import {
  STRAFRECHT_UEBERSICHTSSAMMLUNG_EPISODE_ID,
  STRAFRECHT_UEBERSICHTSSAMMLUNG_SERIES_ID
} from '@shared/podcasts/strafrecht-uebersichtssammlung-august-2026'

describe('criminal law podcast', () => {
  it('includes the overview collection below criminal law', () => {
    const area = PODCAST_CATALOG.legalAreas.find((entry) => entry.slug === 'strafrecht')
    const series = area?.series.find(
      (entry) => entry.id === STRAFRECHT_UEBERSICHTSSAMMLUNG_SERIES_ID
    )

    expect(area?.name).toBe('Strafrecht')
    expect(series).toMatchObject({
      title: 'Übersichtssammlung Strafrecht',
      edition: 'August 2026'
    })
    expect(series?.episodes).toEqual([
      expect.objectContaining({
        id: STRAFRECHT_UEBERSICHTSSAMMLUNG_EPISODE_ID,
        number: 1,
        title: 'Urteilsaufbau und Systematik der Strafzumessung',
        durationSeconds: 1658.776,
        audioUrl:
          'https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio/' +
          'uebersichtssammlung-strafrecht-august-2026/' +
          '01-urteilsaufbau-und-systematik-der-strafzumessung.mp3'
      })
    ])
  })

  it('ships stable manifest IDs for an idempotent upload', () => {
    const manifest = JSON.parse(
      readFileSync(
        'scripts/podcasts/manifests/uebersichtssammlung-strafrecht-august-2026.json',
        'utf8'
      )
    )

    expect(manifest).toMatchObject({
      legalArea: {
        id: 'fb96fddc-fc85-48a1-b746-7903f59681f8',
        slug: 'strafrecht',
        name: 'Strafrecht'
      },
      series: {
        id: STRAFRECHT_UEBERSICHTSSAMMLUNG_SERIES_ID,
        slug: 'uebersichtssammlung-strafrecht-august-2026',
        title: 'Übersichtssammlung Strafrecht'
      },
      episode: {
        id: STRAFRECHT_UEBERSICHTSSAMMLUNG_EPISODE_ID,
        slug: 'urteilsaufbau-und-systematik-der-strafzumessung',
        number: 1,
        durationSeconds: 1658.776
      }
    })
  })
})
