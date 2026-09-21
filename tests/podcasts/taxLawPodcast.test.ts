import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PODCAST_CATALOG } from '@shared/podcasts/catalog'
import {
  STEUERRECHT_AO_EPISODE_ID,
  STEUERRECHT_AO_SERIES_ID
} from '@shared/podcasts/steuerrecht-ao-august-2026'

describe('tax law podcast', () => {
  it('includes Steuerrecht-AO below the Steuerrecht legal area', () => {
    const area = PODCAST_CATALOG.legalAreas.find((entry) => entry.slug === 'steuerrecht')
    const series = area?.series.find((entry) => entry.id === STEUERRECHT_AO_SERIES_ID)

    expect(area?.name).toBe('Steuerrecht')
    expect(series).toMatchObject({
      title: 'Steuerrecht-AO',
      edition: 'August 2026'
    })
    expect(series?.episodes).toEqual([
      expect.objectContaining({
        id: STEUERRECHT_AO_EPISODE_ID,
        number: 1,
        title: 'Die Abgabenordnung als Betriebssystem des Finanzamts',
        durationSeconds: 1413.407,
        audioUrl:
          'https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio/' +
          'steuerrecht-ao-august-2026/' +
          '01-die-abgabenordnung-als-betriebssystem-des-finanzamts.mp3'
      })
    ])
  })

  it('ships stable manifest IDs for an idempotent upload', () => {
    const manifest = JSON.parse(
      readFileSync('scripts/podcasts/manifests/steuerrecht-ao-august-2026.json', 'utf8')
    )

    expect(manifest).toMatchObject({
      legalArea: {
        id: 'b19ffd85-c38c-43a3-870b-63ca52331d70',
        slug: 'steuerrecht',
        name: 'Steuerrecht'
      },
      series: {
        id: STEUERRECHT_AO_SERIES_ID,
        slug: 'steuerrecht-ao-august-2026',
        title: 'Steuerrecht-AO'
      },
      episode: {
        id: STEUERRECHT_AO_EPISODE_ID,
        slug: 'die-abgabenordnung-als-betriebssystem-des-finanzamts',
        number: 1,
        durationSeconds: 1413.407
      }
    })
  })
})
