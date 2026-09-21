import { readFileSync, statSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import {
  resolvePodcastPublishCredentials,
  type PodcastPublishCredentials
} from './publish-podcast'

const MAX_ARTWORK_BYTES = 10_485_760
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

const podcastArtworkInputSchema = z.object({
  apiUrl: z.string().trim().min(1),
  seriesId: z.string().uuid(),
  seriesSlug: slugSchema,
  imageFile: z.string().trim().min(1)
})

export type PodcastArtworkPublishPlan = {
  apiUrl: string
  seriesId: string
  seriesSlug: string
  imageFile: string
  imageSize: number
  storagePath: string
  artworkUrl: string
}

export function buildPodcastArtworkPublishPlan(input: {
  apiUrl: string
  seriesId: string
  seriesSlug: string
  imageFile: string
}): PodcastArtworkPublishPlan {
  const parsed = podcastArtworkInputSchema.parse(input)
  const imageFile = resolve(parsed.imageFile)
  if (extname(imageFile).toLowerCase() !== '.png') {
    throw new Error('Cover muss als PNG vorliegen.')
  }

  const imageSize = statSync(imageFile).size
  if (imageSize === 0) throw new Error('Cover ist leer.')
  if (imageSize > MAX_ARTWORK_BYTES) {
    throw new Error('Cover überschreitet das Limit von 10 MiB.')
  }

  const apiUrl = parsed.apiUrl.replace(/\/+$/, '')
  const storagePath = `${parsed.seriesSlug}/cover.png`
  return {
    apiUrl,
    seriesId: parsed.seriesId,
    seriesSlug: parsed.seriesSlug,
    imageFile,
    imageSize,
    storagePath,
    artworkUrl: `${apiUrl}/storage/v1/object/public/podcast-audio/${storagePath}`
  }
}

export function formatPodcastArtworkDryRun(plan: PodcastArtworkPublishPlan): string {
  return [
    `Dry-run Cover: ${plan.storagePath}`,
    `Größe: ${(plan.imageSize / 1024 / 1024).toFixed(1)} MB`,
    `Ziel: ${plan.apiUrl}`,
    'Mit --apply werden Cover und Katalogeintrag idempotent veröffentlicht.'
  ].join('\n')
}

export async function publishPodcastArtwork(
  plan: PodcastArtworkPublishPlan,
  credentials: PodcastPublishCredentials,
  request: typeof fetch = fetch
): Promise<void> {
  const encodedPath = plan.storagePath.split('/').map(encodeURIComponent).join('/')
  const upload = await request(
    `${plan.apiUrl}/storage/v1/object/podcast-audio/${encodedPath}`,
    {
      method: 'POST',
      headers: {
        apikey: credentials.serviceRoleKey,
        Authorization: `Bearer ${credentials.serviceRoleKey}`,
        'Content-Type': 'image/png',
        'x-upsert': 'true'
      },
      body: readFileSync(plan.imageFile)
    }
  )
  if (!upload.ok) {
    throw new Error(`Cover-Upload fehlgeschlagen (${upload.status}): ${await upload.text()}`)
  }

  const publicCover = await request(plan.artworkUrl, { method: 'HEAD' })
  const contentType = publicCover.headers.get('content-type') ?? ''
  if (!publicCover.ok || !contentType.toLowerCase().includes('image/png')) {
    throw new Error(
      `Öffentliche Cover-Prüfung fehlgeschlagen (${publicCover.status}, ${contentType || 'kein MIME-Type'}).`
    )
  }

  const update = await request(
    `${plan.apiUrl}/rest/v1/podcast_series?id=eq.${encodeURIComponent(plan.seriesId)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: credentials.serviceRoleKey,
        Authorization: `Bearer ${credentials.serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ artwork_url: plan.artworkUrl })
    }
  )
  if (!update.ok) {
    throw new Error(`Cover-Verknüpfung fehlgeschlagen (${update.status}): ${await update.text()}`)
  }

  const catalogResponse = await request(`${plan.apiUrl}/rest/v1/rpc/get_podcast_catalog`, {
    method: 'POST',
    headers: {
      apikey: credentials.publishableKey,
      Authorization: `Bearer ${credentials.publishableKey}`,
      'Content-Type': 'application/json'
    },
    body: '{}'
  })
  if (!catalogResponse.ok) {
    throw new Error(`Öffentliche Katalogprüfung fehlgeschlagen (${catalogResponse.status}).`)
  }
  const catalog = (await catalogResponse.json()) as {
    legalAreas?: Array<{ series?: Array<{ id?: string; artworkUrl?: string | null }> }>
  }
  const artworkUrl = catalog.legalAreas
    ?.flatMap((area) => area.series ?? [])
    .find((series) => series.id === plan.seriesId)?.artworkUrl
  if (artworkUrl !== plan.artworkUrl) {
    throw new Error('Cover fehlt im öffentlichen Podcast-Katalog.')
  }
}

function valueFor(args: string[], prefix: string): string | null {
  return args.find((argument) => argument.startsWith(`${prefix}=`))?.slice(prefix.length + 1) ?? null
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const apiUrl = valueFor(args, '--url')
  const seriesId = valueFor(args, '--series-id')
  const seriesSlug = valueFor(args, '--series-slug')
  const imageFile = valueFor(args, '--image')
  if (!apiUrl) throw new Error('Supabase-URL fehlt. Nutze --url=<url>.')
  if (!seriesId) throw new Error('Serien-ID fehlt. Nutze --series-id=<uuid>.')
  if (!seriesSlug) throw new Error('Serien-Slug fehlt. Nutze --series-slug=<slug>.')
  if (!imageFile) throw new Error('Cover fehlt. Nutze --image=<datei>.')

  const plan = buildPodcastArtworkPublishPlan({ apiUrl, seriesId, seriesSlug, imageFile })
  if (!args.includes('--apply')) {
    console.log(formatPodcastArtworkDryRun(plan))
    return
  }

  await publishPodcastArtwork(plan, resolvePodcastPublishCredentials(process.env))
  console.log(`Podcast-Cover veröffentlicht und öffentlich geprüft: ${plan.seriesSlug}`)
  console.log(`Cover: ${plan.artworkUrl}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
