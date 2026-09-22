import type { PodcastCatalog } from '../schemas'

export const STEUERRECHT_AO_SERIES_ID = '7be6edfa-9c51-48b0-9dde-53f5de29420f'
export const STEUERRECHT_AO_EPISODE_ID = '4e2ed99e-fad8-4f88-947f-becdc6ced300'
export const STEUERRECHT_AO_EPISODE_IDS = {
  abgabenordnung: STEUERRECHT_AO_EPISODE_ID,
  landUndForstwirtschaft: '325acfec-9f6c-458a-9c39-640363865b3c',
  gewerbebetrieb: 'a2909a98-31ca-4057-996d-91d92729cd36',
  selbstaendigeArbeit: '1cca1166-97a2-48a5-9b4e-af0dbe1a1ad5',
  nichtselbstaendigeArbeit: '2454aeb2-8ed1-4f1c-844e-ea789b86f35a',
  kapitalvermoegen: '9f334535-f779-44a9-bf8a-4e71efd69b7b',
  vermietungUndVerpachtung: 'ffdbab61-0c02-47be-813d-8f374b83b286',
  sonstigeEinkuenfte: '20b7a63d-412f-4970-bd7e-d66ce2dc0971'
} as const
export const STEUERRECHT_AO_SLUG = 'steuerrecht-ao-august-2026'

const AUDIO_BASE_URL =
  'https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio/' +
  STEUERRECHT_AO_SLUG
const ARTWORK_URL = `${AUDIO_BASE_URL}/cover.png`

const episodes = [
  {
    id: STEUERRECHT_AO_EPISODE_IDS.abgabenordnung,
    slug: 'die-abgabenordnung-als-betriebssystem-des-finanzamts',
    title: 'Die Abgabenordnung als Betriebssystem des Finanzamts',
    description:
      'Die Abgabenordnung als systematische Grundlage für Organisation, Verfahren und Entscheidungen des Finanzamts.',
    durationSeconds: 1413.407,
    publishedAt: '2026-08-09T00:00:00.000Z'
  },
  {
    id: STEUERRECHT_AO_EPISODE_IDS.landUndForstwirtschaft,
    slug: 'einkuenfte-aus-land-und-forstwirtschaft-13-14a-estg',
    title: 'Einkünfte aus Land- und Forstwirtschaft (§§ 13, 14a EStG)',
    description:
      'Systematik und klausurrelevante Grundlagen der Einkünfte aus Land- und Forstwirtschaft nach §§ 13 und 14a EStG.',
    durationSeconds: 1047.536,
    publishedAt: '2026-09-22T00:00:00.000Z'
  },
  {
    id: STEUERRECHT_AO_EPISODE_IDS.gewerbebetrieb,
    slug: 'einkuenfte-aus-gewerbebetrieb-15-17-estg',
    title: 'Einkünfte aus Gewerbebetrieb (§§ 15–17 EStG)',
    description:
      'Systematik und klausurrelevante Grundlagen der Einkünfte aus Gewerbebetrieb nach §§ 15 bis 17 EStG.',
    durationSeconds: 1591.693,
    publishedAt: '2026-09-22T00:00:00.000Z'
  },
  {
    id: STEUERRECHT_AO_EPISODE_IDS.selbstaendigeArbeit,
    slug: 'einkuenfte-aus-selbstaendiger-arbeit-18-estg',
    title: 'Einkünfte aus selbständiger Arbeit (§ 18 EStG)',
    description:
      'Systematik und klausurrelevante Grundlagen der Einkünfte aus selbständiger Arbeit nach § 18 EStG.',
    durationSeconds: 1512.098,
    publishedAt: '2026-09-22T00:00:00.000Z'
  },
  {
    id: STEUERRECHT_AO_EPISODE_IDS.nichtselbstaendigeArbeit,
    slug: 'einkuenfte-aus-nichtselbstaendiger-arbeit-19-estg',
    title: 'Einkünfte aus nichtselbständiger Arbeit (§ 19 EStG)',
    description:
      'Systematik und klausurrelevante Grundlagen der Einkünfte aus nichtselbständiger Arbeit nach § 19 EStG.',
    durationSeconds: 1275.455,
    publishedAt: '2026-09-22T00:00:00.000Z'
  },
  {
    id: STEUERRECHT_AO_EPISODE_IDS.kapitalvermoegen,
    slug: 'einkuenfte-aus-kapitalvermoegen-20-estg',
    title: 'Einkünfte aus Kapitalvermögen (§ 20 EStG)',
    description:
      'Systematik und klausurrelevante Grundlagen der Einkünfte aus Kapitalvermögen nach § 20 EStG.',
    durationSeconds: 1638.818,
    publishedAt: '2026-09-22T00:00:00.000Z'
  },
  {
    id: STEUERRECHT_AO_EPISODE_IDS.vermietungUndVerpachtung,
    slug: 'einkuenfte-aus-vermietung-und-verpachtung-21-estg',
    title: 'Einkünfte aus Vermietung und Verpachtung (§ 21 EStG)',
    description:
      'Systematik und klausurrelevante Grundlagen der Einkünfte aus Vermietung und Verpachtung nach § 21 EStG.',
    durationSeconds: 1173.133,
    publishedAt: '2026-09-22T00:00:00.000Z'
  },
  {
    id: STEUERRECHT_AO_EPISODE_IDS.sonstigeEinkuenfte,
    slug: 'sonstige-einkuenfte-22-23-estg',
    title: 'Sonstige Einkünfte (§§ 22, 23 EStG)',
    description:
      'Systematik und klausurrelevante Grundlagen der sonstigen Einkünfte nach §§ 22 und 23 EStG.',
    durationSeconds: 828.5,
    publishedAt: '2026-09-22T00:00:00.000Z'
  }
] as const

export const STEUERRECHT_AO_PODCAST_CATALOG: PodcastCatalog = {
  legalAreas: [
    {
      slug: 'steuerrecht',
      name: 'Steuerrecht',
      series: [
        {
          id: STEUERRECHT_AO_SERIES_ID,
          slug: STEUERRECHT_AO_SLUG,
          title: 'Steuerrecht-AO',
          description:
            'Eine Lernreihe zur Abgabenordnung und zu den sieben Einkunftsarten des Einkommensteuerrechts.',
          edition: 'August 2026',
          artworkUrl: ARTWORK_URL,
          episodes: episodes.map((episode, index) => {
            const number = index + 1
            return {
              id: episode.id,
              seriesId: STEUERRECHT_AO_SERIES_ID,
              slug: episode.slug,
              number,
              title: episode.title,
              description: episode.description,
              durationSeconds: episode.durationSeconds,
              audioUrl: `${AUDIO_BASE_URL}/${String(number).padStart(2, '0')}-${episode.slug}.mp3`,
              publishedAt: episode.publishedAt,
              progress: null
            }
          })
        }
      ]
    }
  ]
}
