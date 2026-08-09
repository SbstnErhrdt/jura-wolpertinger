import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const MAX_AUDIO_BYTES = 104_857_600
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const isoDateSchema = z.string().datetime({ offset: true })

export const podcastPublishManifestSchema = z.object({
  legalArea: z.object({
    id: z.string().uuid(),
    slug: slugSchema,
    name: z.string().trim().min(1),
    sortIndex: z.number().int()
  }),
  series: z.object({
    id: z.string().uuid(),
    slug: slugSchema,
    title: z.string().trim().min(1),
    description: z.string(),
    edition: z.string().trim().min(1).nullable(),
    artworkUrl: z.string().url().nullable().optional(),
    sortIndex: z.number().int(),
    publishedAt: isoDateSchema
  }),
  episode: z.object({
    id: z.string().uuid(),
    slug: slugSchema,
    number: z.number().int().positive(),
    title: z.string().trim().min(1),
    description: z.string(),
    durationSeconds: z.number().nonnegative(),
    publishedAt: isoDateSchema
  })
})

export type PodcastPublishManifest = z.infer<typeof podcastPublishManifestSchema>

type LegalAreaRow = {
  id: string
  slug: string
  name: string
  sort_index: number
}

type PodcastSeriesRow = {
  id: string
  legal_area_id: string
  slug: string
  title: string
  description: string
  edition: string | null
  artwork_url: string | null
  sort_index: number
  published_at: string
  is_published: boolean
}

type PodcastEpisodeRow = {
  id: string
  series_id: string
  slug: string
  episode_number: number
  title: string
  description: string
  duration_seconds: number
  storage_path: string
  audio_url: string
  published_at: string
  is_published: boolean
}

export type PodcastPublishPlan = {
  apiUrl: string
  audioFile: string
  audioSize: number
  storagePath: string
  legalArea: LegalAreaRow
  series: PodcastSeriesRow
  episode: PodcastEpisodeRow
}

export type PodcastPublishCredentials = {
  serviceRoleKey: string
  publishableKey: string
}

export function resolvePodcastPublishCredentials(
  environment: Record<string, string | undefined>
): PodcastPublishCredentials {
  const serviceRoleKey =
    environment.SUPABASE_SERVICE_ROLE_KEY ||
    environment.SERVICE_ROLE_KEY ||
    environment.SUPABASE_SECRET_KEY
  const publishableKey =
    environment.SUPABASE_PUBLISHABLE_KEY ||
    environment.SUPABASE_ANON_KEY ||
    environment.VITE_SUPABASE_ANON_KEY ||
    environment.ANON_KEY
  if (!serviceRoleKey) throw new Error('Service-Role-Key fehlt.')
  if (!publishableKey) throw new Error('Publishable-Key für die öffentliche Prüfung fehlt.')
  return { serviceRoleKey, publishableKey }
}

export function buildPodcastPublishPlan(
  manifestInput: unknown,
  audioFile: string,
  apiUrl: string
): PodcastPublishPlan {
  const manifest = podcastPublishManifestSchema.parse(manifestInput)
  const absoluteAudioFile = resolve(audioFile)
  const audioSize = statSync(absoluteAudioFile).size
  if (extname(absoluteAudioFile).toLowerCase() !== '.mp3') {
    throw new Error('Audio muss als MP3 vorliegen.')
  }
  if (audioSize === 0) throw new Error('MP3 ist leer.')
  if (audioSize > MAX_AUDIO_BYTES) {
    throw new Error('MP3 überschreitet das Bucket-Limit von 100 MiB.')
  }

  const normalizedApiUrl = apiUrl.replace(/\/+$/, '')
  if (!normalizedApiUrl) throw new Error('Supabase-URL fehlt.')
  const episodePrefix = String(manifest.episode.number).padStart(2, '0')
  const storagePath = `${manifest.series.slug}/${episodePrefix}-${manifest.episode.slug}.mp3`

  return {
    apiUrl: normalizedApiUrl,
    audioFile: absoluteAudioFile,
    audioSize,
    storagePath,
    legalArea: {
      id: manifest.legalArea.id,
      slug: manifest.legalArea.slug,
      name: manifest.legalArea.name,
      sort_index: manifest.legalArea.sortIndex
    },
    series: {
      id: manifest.series.id,
      legal_area_id: manifest.legalArea.id,
      slug: manifest.series.slug,
      title: manifest.series.title,
      description: manifest.series.description,
      edition: manifest.series.edition,
      artwork_url: manifest.series.artworkUrl ?? null,
      sort_index: manifest.series.sortIndex,
      published_at: manifest.series.publishedAt,
      is_published: true
    },
    episode: {
      id: manifest.episode.id,
      series_id: manifest.series.id,
      slug: manifest.episode.slug,
      episode_number: manifest.episode.number,
      title: manifest.episode.title,
      description: manifest.episode.description,
      duration_seconds: manifest.episode.durationSeconds,
      storage_path: storagePath,
      audio_url: `${normalizedApiUrl}/storage/v1/object/public/podcast-audio/${storagePath}`,
      published_at: manifest.episode.publishedAt,
      is_published: true
    }
  }
}

export async function publishPodcast(
  plan: PodcastPublishPlan,
  credentials: PodcastPublishCredentials,
  request: typeof fetch = fetch
): Promise<void> {
  await upsertRows(plan, credentials.serviceRoleKey, 'podcast_legal_areas', [plan.legalArea], request)
  await upsertRows(
    plan,
    credentials.serviceRoleKey,
    'podcast_series',
    [{ ...plan.series, is_published: false }],
    request
  )
  await upsertRows(
    plan,
    credentials.serviceRoleKey,
    'podcast_episodes',
    [{ ...plan.episode, is_published: false }],
    request
  )
  await uploadAudio(plan, credentials.serviceRoleKey, request)
  await verifyPublicAudio(plan, request)

  let published = false
  try {
    await upsertRows(
      plan,
      credentials.serviceRoleKey,
      'podcast_episodes',
      [plan.episode],
      request
    )
    await upsertRows(
      plan,
      credentials.serviceRoleKey,
      'podcast_series',
      [plan.series],
      request
    )
    published = true
    await verifyPublicCatalog(plan, credentials.publishableKey, request)
  } catch (error) {
    if (published) {
      await upsertRows(
        plan,
        credentials.serviceRoleKey,
        'podcast_episodes',
        [{ ...plan.episode, is_published: false }],
        request
      )
      await upsertRows(
        plan,
        credentials.serviceRoleKey,
        'podcast_series',
        [{ ...plan.series, is_published: false }],
        request
      )
    }
    throw error
  }
}

async function upsertRows(
  plan: PodcastPublishPlan,
  serviceRoleKey: string,
  table: string,
  rows: Array<Record<string, unknown>>,
  request: typeof fetch
): Promise<void> {
  const response = await request(`${plan.apiUrl}/rest/v1/${table}?on_conflict=id`, {
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
  plan: PodcastPublishPlan,
  serviceRoleKey: string,
  request: typeof fetch
): Promise<void> {
  const encodedPath = plan.storagePath.split('/').map(encodeURIComponent).join('/')
  const response = await request(
    `${plan.apiUrl}/storage/v1/object/podcast-audio/${encodedPath}`,
    {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'audio/mpeg',
        'x-upsert': 'true'
      },
      body: readFileSync(plan.audioFile)
    }
  )
  if (!response.ok) {
    throw new Error(`Audio-Upload fehlgeschlagen (${response.status}): ${await response.text()}`)
  }
}

async function verifyPublicAudio(plan: PodcastPublishPlan, request: typeof fetch): Promise<void> {
  const response = await request(plan.episode.audio_url, { method: 'HEAD' })
  const contentType = response.headers.get('content-type') ?? ''
  if (!response.ok || !contentType.toLowerCase().includes('audio/mpeg')) {
    throw new Error(
      `Öffentliche MP3-Prüfung fehlgeschlagen (${response.status}, ${contentType || 'kein MIME-Type'}).`
    )
  }
}

async function verifyPublicCatalog(
  plan: PodcastPublishPlan,
  publishableKey: string,
  request: typeof fetch
): Promise<void> {
  const response = await request(`${plan.apiUrl}/rest/v1/rpc/get_podcast_catalog`, {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
      'Content-Type': 'application/json'
    },
    body: '{}'
  })
  if (!response.ok) {
    throw new Error(`Öffentliche Katalogprüfung fehlgeschlagen (${response.status}).`)
  }
  const catalog = (await response.json()) as {
    legalAreas?: Array<{ series?: Array<{ id?: string; episodes?: Array<{ id?: string }> }> }>
  }
  const publishedEpisode = catalog.legalAreas
    ?.flatMap((area) => area.series ?? [])
    .find((series) => series.id === plan.series.id)
    ?.episodes?.some((episode) => episode.id === plan.episode.id)
  if (!publishedEpisode) throw new Error('Podcast fehlt im öffentlichen Katalog.')
}

type CliArguments = {
  apply: boolean
  apiUrl: string | null
  audioFile: string | null
  envFile: string
  manifestFile: string | null
}

function parseArguments(args: string[]): CliArguments {
  const valueFor = (prefix: string) =>
    args.find((argument) => argument.startsWith(`${prefix}=`))?.slice(prefix.length + 1)
  return {
    apply: args.includes('--apply'),
    apiUrl: valueFor('--url') ?? null,
    audioFile: valueFor('--audio') ?? null,
    envFile: valueFor('--env-file') ?? '../jura-supabase/.env',
    manifestFile: valueFor('--manifest') ?? null
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

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2))
  if (!args.manifestFile) throw new Error('Manifest fehlt. Nutze --manifest=<datei>.')
  if (!args.audioFile) throw new Error('MP3 fehlt. Nutze --audio=<datei>.')
  const environment = { ...readEnvFile(args.envFile), ...process.env }
  const apiUrl =
    args.apiUrl ||
    environment.SUPABASE_URL ||
    environment.SUPABASE_PUBLIC_URL ||
    environment.API_EXTERNAL_URL ||
    environment.VITE_SUPABASE_URL
  if (!apiUrl) throw new Error('Supabase-URL fehlt. Nutze --url oder SUPABASE_URL.')

  const manifest = JSON.parse(readFileSync(resolve(args.manifestFile), 'utf8')) as unknown
  const plan = buildPodcastPublishPlan(manifest, args.audioFile, apiUrl)
  const sizeMegabytes = (plan.audioSize / 1024 / 1024).toFixed(1)
  if (!args.apply) {
    console.log(`Dry-run: ${plan.series.title}, Folge ${plan.episode.episode_number}`)
    console.log(`MP3: ${plan.storagePath} (${sizeMegabytes} MB)`)
    console.log(`Ziel: ${plan.apiUrl}`)
    console.log('Mit --apply werden Metadaten und MP3 idempotent veröffentlicht.')
    return
  }

  await publishPodcast(plan, resolvePodcastPublishCredentials(environment))
  console.log(`Podcast veröffentlicht und öffentlich geprüft: ${plan.series.title}`)
  console.log(`Folge: ${plan.episode.title}`)
  console.log(`MP3: ${plan.episode.audio_url}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
