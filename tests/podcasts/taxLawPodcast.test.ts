import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PODCAST_CATALOG } from '@shared/podcasts/catalog'
import {
  STEUERRECHT_AO_EPISODE_ID,
  STEUERRECHT_AO_SERIES_ID
} from '@shared/podcasts/steuerrecht-ao-august-2026'

const additionalEpisodes = [
  {
    id: '325acfec-9f6c-458a-9c39-640363865b3c',
    number: 2,
    slug: 'einkuenfte-aus-land-und-forstwirtschaft-13-14a-estg',
    title: 'Einkünfte aus Land- und Forstwirtschaft (§§ 13, 14a EStG)',
    manifest: 'steuerrecht-ao-august-2026-02-land-und-forstwirtschaft.json'
  },
  {
    id: 'a2909a98-31ca-4057-996d-91d92729cd36',
    number: 3,
    slug: 'einkuenfte-aus-gewerbebetrieb-15-17-estg',
    title: 'Einkünfte aus Gewerbebetrieb (§§ 15–17 EStG)',
    manifest: 'steuerrecht-ao-august-2026-03-gewerbebetrieb.json'
  },
  {
    id: '1cca1166-97a2-48a5-9b4e-af0dbe1a1ad5',
    number: 4,
    slug: 'einkuenfte-aus-selbstaendiger-arbeit-18-estg',
    title: 'Einkünfte aus selbständiger Arbeit (§ 18 EStG)',
    manifest: 'steuerrecht-ao-august-2026-04-selbstaendige-arbeit.json'
  },
  {
    id: '2454aeb2-8ed1-4f1c-844e-ea789b86f35a',
    number: 5,
    slug: 'einkuenfte-aus-nichtselbstaendiger-arbeit-19-estg',
    title: 'Einkünfte aus nichtselbständiger Arbeit (§ 19 EStG)',
    manifest: 'steuerrecht-ao-august-2026-05-nichtselbstaendige-arbeit.json'
  },
  {
    id: '9f334535-f779-44a9-bf8a-4e71efd69b7b',
    number: 6,
    slug: 'einkuenfte-aus-kapitalvermoegen-20-estg',
    title: 'Einkünfte aus Kapitalvermögen (§ 20 EStG)',
    manifest: 'steuerrecht-ao-august-2026-06-kapitalvermoegen.json'
  },
  {
    id: 'ffdbab61-0c02-47be-813d-8f374b83b286',
    number: 7,
    slug: 'einkuenfte-aus-vermietung-und-verpachtung-21-estg',
    title: 'Einkünfte aus Vermietung und Verpachtung (§ 21 EStG)',
    manifest: 'steuerrecht-ao-august-2026-07-vermietung-und-verpachtung.json'
  },
  {
    id: '20b7a63d-412f-4970-bd7e-d66ce2dc0971',
    number: 8,
    slug: 'sonstige-einkuenfte-22-23-estg',
    title: 'Sonstige Einkünfte (§§ 22, 23 EStG)',
    manifest: 'steuerrecht-ao-august-2026-08-sonstige-einkuenfte.json'
  }
] as const

describe('tax law podcast', () => {
  it('includes Steuerrecht-AO below the Steuerrecht legal area', () => {
    const area = PODCAST_CATALOG.legalAreas.find((entry) => entry.slug === 'steuerrecht')
    const series = area?.series.find((entry) => entry.id === STEUERRECHT_AO_SERIES_ID)

    expect(area?.name).toBe('Steuerrecht')
    expect(series).toMatchObject({
      title: 'Steuerrecht-AO',
      edition: 'August 2026'
    })
    expect(series?.episodes[0]).toMatchObject({
      id: STEUERRECHT_AO_EPISODE_ID,
      number: 1,
      title: 'Die Abgabenordnung als Betriebssystem des Finanzamts',
      durationSeconds: 1413.407,
      audioUrl:
        'https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio/' +
        'steuerrecht-ao-august-2026/' +
        '01-die-abgabenordnung-als-betriebssystem-des-finanzamts.mp3'
    })
    expect(
      series?.episodes.slice(1).map(({ id, number, slug, title }) => ({ id, number, slug, title }))
    ).toEqual(additionalEpisodes.map(({ manifest: _manifest, ...episode }) => episode))
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

    const manifestDirectory = 'scripts/podcasts/manifests'
    const additionalManifestFiles = readdirSync(manifestDirectory)
      .filter((file) => file.startsWith('steuerrecht-ao-august-2026-'))
      .sort()

    expect(additionalManifestFiles).toEqual(additionalEpisodes.map(({ manifest }) => manifest))

    for (const expectedEpisode of additionalEpisodes) {
      const additionalManifest = JSON.parse(
        readFileSync(`${manifestDirectory}/${expectedEpisode.manifest}`, 'utf8')
      )
      expect(additionalManifest).toMatchObject({
        legalArea: manifest.legalArea,
        series: manifest.series,
        episode: {
          id: expectedEpisode.id,
          slug: expectedEpisode.slug,
          number: expectedEpisode.number,
          title: expectedEpisode.title,
          publishedAt: '2026-09-22T00:00:00.000Z'
        }
      })
    }
  })
})
