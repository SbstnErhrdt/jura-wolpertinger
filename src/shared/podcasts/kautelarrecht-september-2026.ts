import type { PodcastCatalog } from '../schemas'

export const KAUTELARRECHT_SERIES_ID = '4d7c41fc-5785-4f0a-baad-22906dbc97bc'
export const KAUTELARRECHT_EPISODE_ID = '7eb18ca2-364b-46b2-89e5-db7a1a24a38f'
export const KAUTELARRECHT_SLUG = 'kautelarrecht-september-2026'

const MEDIA_BASE_URL =
  'https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio/' +
  KAUTELARRECHT_SLUG

export const KAUTELARRECHT_PODCAST_CATALOG: PodcastCatalog = {
  legalAreas: [
    {
      slug: 'zivilrecht',
      name: 'Zivilrecht',
      series: [
        {
          id: KAUTELARRECHT_SERIES_ID,
          slug: KAUTELARRECHT_SLUG,
          title: 'Kautelarrecht',
          description:
            'Eine Lernreihe zu kautelarjuristischen Gestaltungsfragen zwischen Erbrecht, Gesellschaftsrecht und MoPeG.',
          edition: 'September 2026',
          artworkUrl: `${MEDIA_BASE_URL}/cover.png`,
          episodes: [
            {
              id: KAUTELARRECHT_EPISODE_ID,
              seriesId: KAUTELARRECHT_SERIES_ID,
              slug: 'kautelarrecht-von-erbrecht-bis-mopeg',
              number: 1,
              title: 'Kautelarrecht von Erbrecht bis MoPeG',
              description:
                'Kautelarrechtliche Gestaltung von erbrechtlichen Ausgangslagen bis zu den Neuerungen des MoPeG.',
              durationSeconds: 2051.422,
              audioUrl: `${MEDIA_BASE_URL}/01-kautelarrecht-von-erbrecht-bis-mopeg.mp3`,
              publishedAt: '2026-09-20T00:00:00.000Z',
              progress: null
            }
          ]
        }
      ]
    }
  ]
}
