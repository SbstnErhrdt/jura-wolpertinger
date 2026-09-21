import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PODCAST_CATALOG } from '@shared/podcasts/catalog'
import {
  KAUTELARRECHT_EPISODE_ID,
  KAUTELARRECHT_PODCAST_CATALOG,
  KAUTELARRECHT_SERIES_ID,
  KAUTELARRECHT_SLUG
} from '@shared/podcasts/kautelarrecht-september-2026'

const ARTWORK_BASE =
  'https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio'
const MANIFEST_PATH = 'scripts/podcasts/manifests/kautelarrecht-september-2026.json'

describe('Kautelarrecht podcast', () => {
  it('adds the September 2026 series to Zivilrecht with stable public media', () => {
    const area = KAUTELARRECHT_PODCAST_CATALOG.legalAreas[0]
    const series = area.series[0]
    const episode = series.episodes[0]

    expect(area).toMatchObject({ slug: 'zivilrecht', name: 'Zivilrecht' })
    expect(series).toMatchObject({
      id: '4d7c41fc-5785-4f0a-baad-22906dbc97bc',
      slug: 'kautelarrecht-september-2026',
      title: 'Kautelarrecht',
      edition: 'September 2026',
      artworkUrl: `${ARTWORK_BASE}/kautelarrecht-september-2026/cover.png`
    })
    expect(episode).toMatchObject({
      id: '7eb18ca2-364b-46b2-89e5-db7a1a24a38f',
      seriesId: KAUTELARRECHT_SERIES_ID,
      slug: 'kautelarrecht-von-erbrecht-bis-mopeg',
      number: 1,
      title: 'Kautelarrecht von Erbrecht bis MoPeG',
      durationSeconds: 2051.422,
      audioUrl:
        `${ARTWORK_BASE}/${KAUTELARRECHT_SLUG}/` +
        '01-kautelarrecht-von-erbrecht-bis-mopeg.mp3'
    })
    expect(KAUTELARRECHT_EPISODE_ID).toBe(episode.id)
    expect(PODCAST_CATALOG.legalAreas.find((candidate) => candidate.slug === 'zivilrecht'))
      .toEqual(area)
  })

  it('keeps manifest, catalog and every series artwork URL aligned', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
    const series = KAUTELARRECHT_PODCAST_CATALOG.legalAreas[0].series[0]
    const episode = series.episodes[0]

    expect(manifest.legalArea).toEqual({
      id: '172b38f6-bf72-4b1b-9af4-f7d1e7337728',
      slug: 'zivilrecht',
      name: 'Zivilrecht',
      sortIndex: 0
    })
    expect(manifest.series).toMatchObject({
      id: series.id,
      slug: series.slug,
      title: series.title,
      edition: series.edition,
      artworkUrl: series.artworkUrl,
      sortIndex: 10,
      publishedAt: '2026-09-20T00:00:00.000Z'
    })
    expect(manifest.episode).toMatchObject({
      id: episode.id,
      slug: episode.slug,
      number: episode.number,
      title: episode.title,
      durationSeconds: episode.durationSeconds,
      publishedAt: episode.publishedAt
    })

    for (const legalArea of PODCAST_CATALOG.legalAreas) {
      for (const catalogSeries of legalArea.series) {
        expect(catalogSeries.artworkUrl).toBe(
          `${ARTWORK_BASE}/${catalogSeries.slug}/cover.png`
        )
      }
    }
  })
})
