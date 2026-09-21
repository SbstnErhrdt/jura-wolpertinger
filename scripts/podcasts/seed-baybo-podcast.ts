import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BAYBO_PODCAST_CATALOG,
  BAYBO_PODCAST_SERIES_ID,
  BAYBO_PODCAST_SLUG
} from '../../src/shared/podcasts/baybo-april-2026'

const LEGAL_AREA_ID = 'ba7b2026-0400-4000-8000-000000000000'
const DEFAULT_SOURCE_ROOT = 'output/learning-podcasts/baybo-april-2026'
const DEFAULT_ENV_FILE = '../jura-supabase/.env'

type SeriesPlan = {
  title: string
  episodes: Array<{ number: number; slug: string; title: string }>
}

export type BayboSeedPlan = ReturnType<typeof buildBayboSeedPlan>

export function buildBayboSeedPlan(sourceRoot: string, apiUrl: string) {
  const absoluteRoot = resolve(sourceRoot)
  const seriesPlan = JSON.parse(
    readFileSync(resolve(absoluteRoot, 'series-plan.json'), 'utf8')
  ) as SeriesPlan
  const summary = JSON.parse(
    readFileSync(resolve(absoluteRoot, 'summary.json'), 'utf8')
  ) as { episode_count: number; mp3_paths: string[] }
  const catalogSeries = BAYBO_PODCAST_CATALOG.legalAreas[0]?.series[0]
  if (!catalogSeries || seriesPlan.episodes.length !== 18 || summary.episode_count !== 18) {
    throw new Error('Der BayBO-Podcast muss exakt 18 Folgen enthalten.')
  }

  const normalizedApiUrl = apiUrl.replace(/\/+$/, '')
  const episodes = seriesPlan.episodes.map((sourceEpisode) => {
    const catalogEpisode = catalogSeries.episodes.find(
      (episode) => episode.number === sourceEpisode.number
    )
    if (!catalogEpisode || catalogEpisode.slug !== sourceEpisode.slug) {
      throw new Error(`Katalogdaten für Folge ${sourceEpisode.number} stimmen nicht überein.`)
    }
    const directory = `${String(sourceEpisode.number).padStart(2, '0')}-${sourceEpisode.slug}`
    const storagePath = `${BAYBO_PODCAST_SLUG}/${directory}.mp3`
    return {
      id: catalogEpisode.id,
      series_id: BAYBO_PODCAST_SERIES_ID,
      slug: catalogEpisode.slug,
      episode_number: catalogEpisode.number,
      title: catalogEpisode.title,
      description: catalogEpisode.description,
      duration_seconds: catalogEpisode.durationSeconds,
      storage_path: storagePath,
      audio_url: `${normalizedApiUrl}/storage/v1/object/public/podcast-audio/${storagePath}`,
      published_at: catalogEpisode.publishedAt,
      is_published: true
    }
  })
  const uploads = episodes.map((episode) => {
    const directory = `${String(episode.episode_number).padStart(2, '0')}-${episode.slug}`
    const filePath = resolve(absoluteRoot, 'episodes', directory, `${directory}.mp3`)
    if (!existsSync(filePath)) throw new Error(`MP3 fehlt: ${filePath}`)
    return {
      episodeId: episode.id,
      filePath,
      storagePath: episode.storage_path,
      size: statSync(filePath).size
    }
  })
  const listedMp3Files = new Set(summary.mp3_paths.map((path) => resolve(path)))
  for (const upload of uploads) {
    if (!listedMp3Files.has(upload.filePath)) {
      throw new Error(`summary.json enthält die MP3 nicht: ${upload.filePath}`)
    }
  }

  return {
    legalArea: {
      id: LEGAL_AREA_ID,
      slug: 'oeffentliches-recht',
      name: 'Öffentliches Recht',
      sort_index: 20
    },
    series: {
      id: BAYBO_PODCAST_SERIES_ID,
      legal_area_id: LEGAL_AREA_ID,
      slug: BAYBO_PODCAST_SLUG,
      title: catalogSeries.title,
      description: catalogSeries.description,
      edition: catalogSeries.edition,
      artwork_url: catalogSeries.artworkUrl,
      sort_index: 10,
      published_at: '2026-04-01T00:00:00.000Z',
      is_published: true
    },
    episodes,
    uploads
  }
}

async function seedBayboPodcast(): Promise<void> {
  const args = parseArguments(process.argv.slice(2))
  const env = {
    ...readEnvFile(args.envFile),
    ...process.env
  }
  const apiUrl =
    args.apiUrl ||
    env.SUPABASE_URL ||
    env.SUPABASE_PUBLIC_URL ||
    env.API_EXTERNAL_URL ||
    env.VITE_SUPABASE_URL
  if (!apiUrl) throw new Error('Supabase-URL fehlt. Nutze --url oder SUPABASE_URL.')
  const plan = buildBayboSeedPlan(args.sourceRoot, apiUrl)
  const totalBytes = plan.uploads.reduce((sum, upload) => sum + upload.size, 0)

  if (!args.apply) {
    console.log(
      `Dry-run: ${plan.episodes.length} Folgen, ${formatMegabytes(totalBytes)} MB, Ziel ${apiUrl}`
    )
    console.log('Mit --apply werden Katalog und MP3-Dateien idempotent hochgeladen.')
    return
  }

  const serviceRoleKey =
    env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY
  if (!serviceRoleKey) {
    throw new Error('Service-Role-Key fehlt. Nutze SUPABASE_SERVICE_ROLE_KEY oder SERVICE_ROLE_KEY.')
  }

  await upsertRows(apiUrl, serviceRoleKey, 'podcast_legal_areas', [plan.legalArea])
  await upsertRows(apiUrl, serviceRoleKey, 'podcast_series', [
    { ...plan.series, is_published: false }
  ])
  await upsertRows(
    apiUrl,
    serviceRoleKey,
    'podcast_episodes',
    plan.episodes.map((episode) => ({ ...episode, is_published: false }))
  )

  await runWithConcurrency(plan.uploads, 3, async (upload, index) => {
    await uploadAudio(apiUrl, serviceRoleKey, upload.storagePath, upload.filePath)
    console.log(
      `[${index + 1}/${plan.uploads.length}] ${upload.storagePath} (${formatMegabytes(upload.size)} MB)`
    )
  })

  await upsertRows(apiUrl, serviceRoleKey, 'podcast_episodes', plan.episodes)
  await upsertRows(apiUrl, serviceRoleKey, 'podcast_series', [plan.series])
  console.log(`Podcast veröffentlicht: ${plan.episodes.length} Folgen, ${formatMegabytes(totalBytes)} MB.`)
}

async function upsertRows(
  apiUrl: string,
  serviceRoleKey: string,
  table: string,
  rows: Array<Record<string, unknown>>
): Promise<void> {
  const response = await fetch(`${apiUrl.replace(/\/+$/, '')}/rest/v1/${table}?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(rows)
  })
  if (!response.ok) {
    throw new Error(`${table}-Upsert fehlgeschlagen (${response.status}): ${await response.text()}`)
  }
}

async function uploadAudio(
  apiUrl: string,
  serviceRoleKey: string,
  storagePath: string,
  filePath: string
): Promise<void> {
  const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/')
  const response = await fetch(
    `${apiUrl.replace(/\/+$/, '')}/storage/v1/object/podcast-audio/${encodedPath}`,
    {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'audio/mpeg',
        'x-upsert': 'true'
      },
      body: readFileSync(filePath)
    }
  )
  if (!response.ok) {
    throw new Error(`Audio-Upload fehlgeschlagen (${response.status}): ${await response.text()}`)
  }
}

async function runWithConcurrency<T>(
  values: T[],
  concurrency: number,
  task: (value: T, index: number) => Promise<void>
): Promise<void> {
  let nextIndex = 0
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex
        nextIndex += 1
        await task(values[index], index)
      }
    })
  )
}

function parseArguments(args: string[]): {
  apply: boolean
  apiUrl: string | null
  envFile: string
  sourceRoot: string
} {
  const valueFor = (prefix: string) =>
    args.find((argument) => argument.startsWith(`${prefix}=`))?.slice(prefix.length + 1)
  return {
    apply: args.includes('--apply'),
    apiUrl: valueFor('--url') ?? null,
    envFile: valueFor('--env-file') ?? DEFAULT_ENV_FILE,
    sourceRoot: valueFor('--source') ?? DEFAULT_SOURCE_ROOT
  }
}

function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {}
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=')
        return [
          line.slice(0, separator),
          line.slice(separator + 1).replace(/^(['"])(.*)\1$/, '$2')
        ]
      })
  )
}

function formatMegabytes(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  seedBayboPodcast().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
