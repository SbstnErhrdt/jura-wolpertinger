import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PODCAST_CATALOG } from '@shared/podcasts/catalog'
import {
  GRUNDSKRIPT_STEUERRECHT_EPISODE_ID,
  GRUNDSKRIPT_STEUERRECHT_PODCAST_CATALOG,
  GRUNDSKRIPT_STEUERRECHT_SERIES_ID,
  GRUNDSKRIPT_STEUERRECHT_SLUG
} from '@shared/podcasts/grundskript-steuerrecht-april-2026'

const MEDIA_BASE =
  'https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio'
const MANIFEST_PATH =
  'scripts/podcasts/manifests/grundskript-steuerrecht-april-2026.json'

describe('Grundskript Steuerrecht podcast', () => {
  it('adds the April 2026 series to Steuerrecht with stable public media', () => {
    const area = GRUNDSKRIPT_STEUERRECHT_PODCAST_CATALOG.legalAreas[0]
    const series = area.series[0]
    const episode = series.episodes[0]

    expect(area).toMatchObject({ slug: 'steuerrecht', name: 'Steuerrecht' })
    expect(series).toMatchObject({
      id: '7d61a370-ece1-4c4a-a613-3b2c00707fce',
      slug: 'grundskript-steuerrecht-april-2026',
      title: 'Grundskript Steuerrecht',
      edition: 'April 2026',
      artworkUrl: `${MEDIA_BASE}/grundskript-steuerrecht-april-2026/cover.png`
    })
    expect(episode).toMatchObject({
      id: '2abfbda4-e81d-4e31-b518-d319bf56c391',
      seriesId: GRUNDSKRIPT_STEUERRECHT_SERIES_ID,
      slug: 'systematik-des-einkommensteuerrechts-im-zweiten-staatsexamen',
      number: 1,
      title: 'Systematik des Einkommensteuerrechts im zweiten Staatsexamen',
      durationSeconds: 1740.487,
      audioUrl:
        `${MEDIA_BASE}/${GRUNDSKRIPT_STEUERRECHT_SLUG}/` +
        '01-systematik-des-einkommensteuerrechts-im-zweiten-staatsexamen.mp3'
    })
    expect(GRUNDSKRIPT_STEUERRECHT_EPISODE_ID).toBe(episode.id)
    const mergedArea = PODCAST_CATALOG.legalAreas.find(
      (candidate) => candidate.slug === 'steuerrecht'
    )
    expect(mergedArea?.series).toContainEqual(series)
  })

  it('keeps manifest and catalog metadata aligned', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
    const series = GRUNDSKRIPT_STEUERRECHT_PODCAST_CATALOG.legalAreas[0].series[0]
    const episode = series.episodes[0]

    expect(manifest.legalArea).toEqual({
      id: 'b19ffd85-c38c-43a3-870b-63ca52331d70',
      slug: 'steuerrecht',
      name: 'Steuerrecht',
      sortIndex: 30
    })
    expect(manifest.series).toMatchObject({
      id: series.id,
      slug: series.slug,
      title: series.title,
      description: series.description,
      edition: series.edition,
      artworkUrl: series.artworkUrl,
      sortIndex: 20,
      publishedAt: '2026-09-21T00:00:00.000Z'
    })
    expect(manifest.episode).toMatchObject({
      id: episode.id,
      slug: episode.slug,
      number: episode.number,
      title: episode.title,
      description: episode.description,
      durationSeconds: episode.durationSeconds,
      publishedAt: episode.publishedAt
    })
  })
})
