import type { PodcastCatalog } from '../schemas'

export const VORLAEUFIGER_RECHTSSCHUTZ_SERIES_ID = 'e78242ec-0550-4a37-a7ad-ca740b139762'
export const VORLAEUFIGER_RECHTSSCHUTZ_EPISODE_ID = '8156bd9a-918d-4654-a1af-57567fff2b4d'
export const VORLAEUFIGER_RECHTSSCHUTZ_SLUG = 'vorlaeufiger-rechtsschutz-august-2026'

const EPISODE_SLUG = 'schild-und-schwert-im-bayerischen-eilrechtsschutz'
const AUDIO_URL =
  'https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio/' +
  `${VORLAEUFIGER_RECHTSSCHUTZ_SLUG}/01-${EPISODE_SLUG}.mp3`
const ARTWORK_URL =
  'https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio/' +
  `${VORLAEUFIGER_RECHTSSCHUTZ_SLUG}/cover.png`

export const VORLAEUFIGER_RECHTSSCHUTZ_PODCAST_CATALOG: PodcastCatalog = {
  legalAreas: [
    {
      slug: 'oeffentliches-recht',
      name: 'Öffentliches Recht',
      series: [
        {
          id: VORLAEUFIGER_RECHTSSCHUTZ_SERIES_ID,
          slug: VORLAEUFIGER_RECHTSSCHUTZ_SLUG,
          title: 'Vorläufiger Rechtsschutz',
          description:
            'Eine Lernreihe zu den Strukturen und Klausurproblemen des vorläufigen verwaltungsgerichtlichen Rechtsschutzes.',
          edition: 'August 2026',
          artworkUrl: ARTWORK_URL,
          episodes: [
            {
              id: VORLAEUFIGER_RECHTSSCHUTZ_EPISODE_ID,
              seriesId: VORLAEUFIGER_RECHTSSCHUTZ_SERIES_ID,
              slug: EPISODE_SLUG,
              number: 1,
              title: 'Schild und Schwert im bayerischen Eilrechtsschutz',
              description:
                'Vorläufiger Rechtsschutz als Schild und Schwert mit den klausurrelevanten Besonderheiten des bayerischen Verwaltungsrechts.',
              durationSeconds: 2064.118,
              audioUrl: AUDIO_URL,
              publishedAt: '2026-08-25T00:00:00.000Z',
              progress: null
            }
          ]
        }
      ]
    }
  ]
}
