import {
  mkdtempSync,
  readFileSync,
  rmSync,
  truncateSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildPodcastPublishPlan,
  publishPodcast,
  resolvePodcastPublishCredentials,
  type PodcastPublishManifest
} from '../../scripts/podcasts/publish-podcast'

const manifest: PodcastPublishManifest = {
  legalArea: {
    id: 'ba7b2026-0400-4000-8000-000000000000',
    slug: 'oeffentliches-recht',
    name: 'Öffentliches Recht',
    sortIndex: 20
  },
  series: {
    id: '7ca1a2cc-17be-4aec-a833-d4cf4ad1e3bf',
    slug: 'polizei-und-sicherheitsrecht-august-2026',
    title: 'Polizei- und Sicherheitsrecht',
    description:
      'Eine Lernfolge zu typischen Klausurfallen im bayerischen Polizei- und Versammlungsrecht.',
    edition: 'August 2026',
    artworkUrl:
      'https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio/' +
      'polizei-und-sicherheitsrecht-august-2026/cover.png',
    sortIndex: 20,
    publishedAt: '2026-08-09T00:00:00.000Z'
  },
  episode: {
    id: '2756538a-67e2-4457-8f0e-a94764e99233',
    slug: 'klausurfallen-im-bayerischen-polizei-und-versammlungsrecht',
    number: 1,
    title: 'Klausurfallen im bayerischen Polizei- und Versammlungsrecht',
    description:
      'Typische Prüfungsprobleme und Fehlerquellen im bayerischen Polizei- und Versammlungsrecht.',
    durationSeconds: 1555.043,
    publishedAt: '2026-08-09T00:00:00.000Z'
  }
}

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

function temporaryAudioFile(name = 'episode.mp3'): string {
  const directory = mkdtempSync(join(tmpdir(), 'podcast-publisher-'))
  temporaryDirectories.push(directory)
  const path = join(directory, name)
  writeFileSync(path, Buffer.from('ID3-test-audio'))
  return path
}

describe('podcast publisher plan', () => {
  it('uses the production ANON_KEY as the public verification credential', () => {
    expect(
      resolvePodcastPublishCredentials({ SERVICE_ROLE_KEY: 'service-test', ANON_KEY: 'anon-test' })
    ).toEqual({ serviceRoleKey: 'service-test', publishableKey: 'anon-test' })
  })

  it('ships the approved police-law publication manifest', () => {
    const approvedManifest = JSON.parse(
      readFileSync(
        'scripts/podcasts/manifests/polizei-und-sicherheitsrecht-august-2026.json',
        'utf8'
      )
    )

    expect(approvedManifest).toEqual(manifest)
  })

  it('derives stable Supabase rows and the public storage URL', () => {
    const plan = buildPodcastPublishPlan(
      manifest,
      temporaryAudioFile(),
      'https://app.jura-wolpi.de/api/'
    )

    expect(plan.storagePath).toBe(
      'polizei-und-sicherheitsrecht-august-2026/' +
        '01-klausurfallen-im-bayerischen-polizei-und-versammlungsrecht.mp3'
    )
    expect(plan.series).toMatchObject({
      id: '7ca1a2cc-17be-4aec-a833-d4cf4ad1e3bf',
      legal_area_id: 'ba7b2026-0400-4000-8000-000000000000',
      is_published: true
    })
    expect(plan.episode).toMatchObject({
      id: '2756538a-67e2-4457-8f0e-a94764e99233',
      series_id: '7ca1a2cc-17be-4aec-a833-d4cf4ad1e3bf',
      audio_url:
        'https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio/' +
        'polizei-und-sicherheitsrecht-august-2026/' +
        '01-klausurfallen-im-bayerischen-polizei-und-versammlungsrecht.mp3',
      is_published: true
    })
  })

  it('rejects files that are not MP3 audio', () => {
    expect(() =>
      buildPodcastPublishPlan(
        manifest,
        temporaryAudioFile('episode.m4a'),
        'https://app.jura-wolpi.de/api'
      )
    ).toThrow('Audio muss als MP3 vorliegen.')
  })

  it('rejects files above the 100 MiB bucket limit', () => {
    const path = temporaryAudioFile()
    truncateSync(path, 104_857_601)

    expect(() =>
      buildPodcastPublishPlan(manifest, path, 'https://app.jura-wolpi.de/api')
    ).toThrow('MP3 überschreitet das Bucket-Limit von 100 MiB.')
  })
})

describe('podcast publication', () => {
  it('uploads hidden metadata and audio before publishing and checking the anonymous catalog', async () => {
    const plan = buildPodcastPublishPlan(
      manifest,
      temporaryAudioFile(),
      'https://app.jura-wolpi.de/api'
    )
    const requests: Array<{ url: string; init: RequestInit }> = []
    const request: typeof fetch = async (input, init = {}) => {
      const url = String(input)
      requests.push({ url, init })
      if (url.endsWith('/rest/v1/rpc/get_podcast_catalog')) {
        return Response.json({
          legalAreas: [
            {
              slug: 'oeffentliches-recht',
              series: [
                {
                  id: plan.series.id,
                  episodes: [{ id: plan.episode.id }]
                }
              ]
            }
          ]
        })
      }
      return new Response(null, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
    }

    await publishPodcast(
      plan,
      { serviceRoleKey: 'service-test', publishableKey: 'anon-test' },
      request
    )

    expect(requests.map(({ url, init }) => `${init.method} ${new URL(url).pathname}`)).toEqual([
      'POST /api/rest/v1/podcast_legal_areas',
      'POST /api/rest/v1/podcast_series',
      'POST /api/rest/v1/podcast_episodes',
      'POST /api/storage/v1/object/podcast-audio/' + plan.storagePath,
      'HEAD /api/storage/v1/object/public/podcast-audio/' + plan.storagePath,
      'POST /api/rest/v1/podcast_episodes',
      'POST /api/rest/v1/podcast_series',
      'POST /api/rest/v1/rpc/get_podcast_catalog'
    ])
    expect(JSON.parse(String(requests[1].init.body))).toEqual([
      expect.objectContaining({ id: plan.series.id, is_published: false })
    ])
    expect(JSON.parse(String(requests[2].init.body))).toEqual([
      expect.objectContaining({ id: plan.episode.id, is_published: false })
    ])
    expect(JSON.parse(String(requests[5].init.body))).toEqual([
      expect.objectContaining({ id: plan.episode.id, is_published: true })
    ])
    expect(new Headers(requests[7].init.headers).get('apikey')).toBe('anon-test')
  })

  it('hides episode and series again when anonymous catalog verification fails', async () => {
    const plan = buildPodcastPublishPlan(
      manifest,
      temporaryAudioFile(),
      'https://app.jura-wolpi.de/api'
    )
    const requests: Array<{ url: string; init: RequestInit }> = []
    const request: typeof fetch = async (input, init = {}) => {
      const url = String(input)
      requests.push({ url, init })
      if (url.endsWith('/rest/v1/rpc/get_podcast_catalog')) {
        return Response.json({ legalAreas: [] })
      }
      return new Response(null, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
    }

    await expect(
      publishPodcast(
        plan,
        { serviceRoleKey: 'service-test', publishableKey: 'anon-test' },
        request
      )
    ).rejects.toThrow('Podcast fehlt im öffentlichen Katalog.')

    const finalBodies = requests.slice(-2).map(({ init }) => JSON.parse(String(init.body)))
    expect(finalBodies).toEqual([
      [expect.objectContaining({ id: plan.episode.id, is_published: false })],
      [expect.objectContaining({ id: plan.series.id, is_published: false })]
    ])
  })
})
