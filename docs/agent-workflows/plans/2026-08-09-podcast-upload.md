# Polizei- und Sicherheitsrecht Podcast Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $subagent-driven-development (recommended) or $executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine einzelne Lernfolge als Reihe „Polizei- und Sicherheitsrecht“ im öffentlichen Supabase-Katalog und im lokalen Desktop-Fallback veröffentlichen sowie den Ablauf als Skill reproduzierbar machen.

**Architecture:** Ein eingecheckter Podcast-Katalog aggregiert die bestehende BayBO-Reihe und die neue Polizeirechtsreihe. Ein generischer Manifest-basierter Publisher bereitet idempotente REST- und Storage-Upserts vor, veröffentlicht Metadaten erst nach erfolgreichem Audio-Upload und verifiziert anschließend den anonym sichtbaren Katalog. Der Repository-Skill kapselt Audio-Konvertierung, Dry-Run, Veröffentlichung und öffentliche Prüfung.

**Tech Stack:** TypeScript 5.7, Node.js/tsx, Vitest, Zod, Supabase REST/Storage/RPC, macOS `afconvert`/`afinfo`, Codex Skills.

## Global Constraints

- Rechtsgebiet: `Öffentliches Recht`.
- Reihe: `Polizei- und Sicherheitsrecht`.
- Ausgabe: `August 2026`.
- Folge 1: `Klausurfallen im bayerischen Polizei- und Versammlungsrecht`.
- Der Storage-Bucket akzeptiert höchstens 100 MiB und ausschließlich `audio/mpeg` beziehungsweise MP3.
- Ohne `--apply` darf keine Produktionsänderung stattfinden.
- Reihe und Folge bleiben bis zum verifizierten Audio-Upload unveröffentlicht.
- Service-Role- und Publishable-Keys dürfen nie in Markdown, Git, Logs oder Abschlussnachrichten ausgegeben werden.
- Bestehende Podcast-Reihen und Audiodateien dürfen weder gelöscht noch unter fremden Storage-Pfaden überschrieben werden.
- Die bereits vorhandenen fremden Worktree-Änderungen bleiben erhalten; Implementierungsdateien werden in diesem dirty Worktree nicht automatisch committed.

---

## File Structure

- `src/shared/podcasts/polizei-und-sicherheitsrecht-august-2026.ts`: stabile lokale Katalogdaten der neuen Reihe.
- `src/shared/podcasts/catalog.ts`: Aggregation aller eingecheckten Podcast-Reihen für den Desktop-Fallback.
- `scripts/podcasts/publish-podcast.ts`: generischer, idempotenter Manifest-Publisher und CLI.
- `scripts/podcasts/manifests/polizei-und-sicherheitsrecht-august-2026.json`: produktionsneutrale Metadaten ohne Zugangsdaten oder lokale Audiodateipfade.
- `tests/podcasts/podcastCatalog.test.ts`: Vertrag für Reihenname, Folge, IDs und Aggregation.
- `tests/podcasts/podcastPublisher.test.ts`: Vertrag für Manifest-Validierung, Storage-Pfad und Dry-Run-Plan.
- `skills/podcast-hochladen/SKILL.md`: exakter Workflow für spätere Uploads.
- `skills/podcast-hochladen/agents/openai.yaml`: UI-Metadaten des Skills.
- `src/main/services/services.ts`: Desktop-Dienst auf den aggregierten Fallback-Katalog umstellen.
- `package.json`: generischen Publisher als `podcasts:publish` aufrufbar machen.

### Task 1: Neuer Desktop-Katalog

**Files:**
- Create: `tests/podcasts/podcastCatalog.test.ts`
- Create: `src/shared/podcasts/polizei-und-sicherheitsrecht-august-2026.ts`
- Create: `src/shared/podcasts/catalog.ts`
- Modify: `src/main/services/services.ts:134`
- Modify: `src/main/services/services.ts:1426-1437`

**Interfaces:**
- Consumes: `PodcastCatalog` aus `src/shared/schemas.ts` und `BAYBO_PODCAST_CATALOG`.
- Produces: `POLIZEI_SICHERHEITSRECHT_SERIES_ID`, `POLIZEI_SICHERHEITSRECHT_EPISODE_ID`, `POLIZEI_SICHERHEITSRECHT_PODCAST_CATALOG` und `PODCAST_CATALOG`.

- [ ] **Step 1: Write the failing catalog test**

```ts
import { describe, expect, it } from 'vitest'
import { PODCAST_CATALOG } from '@shared/podcasts/catalog'
import {
  POLIZEI_SICHERHEITSRECHT_EPISODE_ID,
  POLIZEI_SICHERHEITSRECHT_SERIES_ID
} from '@shared/podcasts/polizei-und-sicherheitsrecht-august-2026'

describe('podcast catalog', () => {
  it('includes police and security law below public law', () => {
    const area = PODCAST_CATALOG.legalAreas.find((entry) => entry.slug === 'oeffentliches-recht')
    const series = area?.series.find((entry) => entry.id === POLIZEI_SICHERHEITSRECHT_SERIES_ID)

    expect(series).toMatchObject({ title: 'Polizei- und Sicherheitsrecht', edition: 'August 2026' })
    expect(series?.episodes).toEqual([
      expect.objectContaining({
        id: POLIZEI_SICHERHEITSRECHT_EPISODE_ID,
        number: 1,
        title: 'Klausurfallen im bayerischen Polizei- und Versammlungsrecht'
      })
    ])
  })
})
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run: `pnpm vitest run tests/podcasts/podcastCatalog.test.ts`

Expected: FAIL because `@shared/podcasts/catalog` does not exist.

- [ ] **Step 3: Add the police-law catalog and aggregate it with BayBO**

```ts
export const POLIZEI_SICHERHEITSRECHT_SERIES_ID = '7ca1a2cc-17be-4aec-a833-d4cf4ad1e3bf'
export const POLIZEI_SICHERHEITSRECHT_EPISODE_ID = '2756538a-67e2-4457-8f0e-a94764e99233'

export const POLIZEI_SICHERHEITSRECHT_PODCAST_CATALOG: PodcastCatalog = {
  legalAreas: [{
    slug: 'oeffentliches-recht',
    name: 'Öffentliches Recht',
    series: [{
      id: POLIZEI_SICHERHEITSRECHT_SERIES_ID,
      slug: 'polizei-und-sicherheitsrecht-august-2026',
      title: 'Polizei- und Sicherheitsrecht',
      description: 'Eine Lernfolge zu typischen Klausurfallen im bayerischen Polizei- und Versammlungsrecht.',
      edition: 'August 2026',
      artworkUrl: null,
      episodes: [{
        id: POLIZEI_SICHERHEITSRECHT_EPISODE_ID,
        seriesId: POLIZEI_SICHERHEITSRECHT_SERIES_ID,
        slug: 'klausurfallen-im-bayerischen-polizei-und-versammlungsrecht',
        number: 1,
        title: 'Klausurfallen im bayerischen Polizei- und Versammlungsrecht',
        description: 'Typische Prüfungsprobleme und Fehlerquellen im bayerischen Polizei- und Versammlungsrecht.',
        durationSeconds: 1554.969,
        audioUrl: 'https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio/polizei-und-sicherheitsrecht-august-2026/01-klausurfallen-im-bayerischen-polizei-und-versammlungsrecht.mp3',
        publishedAt: '2026-08-09T00:00:00.000Z',
        progress: null
      }]
    }]
  }]
}
```

Merge catalogs by legal-area slug, append the police-law series after BayBO, export the result as `PODCAST_CATALOG`, and make `getPodcastCatalog()` apply user progress to that aggregate.

- [ ] **Step 4: Run catalog and local progress tests**

Run: `pnpm vitest run tests/podcasts/podcastCatalog.test.ts tests/main/services.test.ts`

Expected: PASS; the first BayBO episode remains unchanged and the new series is present.

### Task 2: Generic idempotent publisher

**Files:**
- Create: `tests/podcasts/podcastPublisher.test.ts`
- Create: `scripts/podcasts/publish-podcast.ts`
- Create: `scripts/podcasts/manifests/polizei-und-sicherheitsrecht-august-2026.json`
- Modify: `package.json:30`

**Interfaces:**
- Consumes: a JSON `PodcastPublishManifest`, an existing MP3 path and a Supabase API URL.
- Produces: `buildPodcastPublishPlan(manifest, audioFile, apiUrl): PodcastPublishPlan` and CLI `pnpm podcasts:publish -- --manifest=... --audio=... [--apply]`.

- [ ] **Step 1: Write failing publisher-plan tests**

```ts
const plan = buildPodcastPublishPlan(manifest, audioPath, 'https://app.jura-wolpi.de/api')
expect(plan.storagePath).toBe(
  'polizei-und-sicherheitsrecht-august-2026/01-klausurfallen-im-bayerischen-polizei-und-versammlungsrecht.mp3'
)
expect(plan.episode).toMatchObject({
  id: '2756538a-67e2-4457-8f0e-a94764e99233',
  series_id: '7ca1a2cc-17be-4aec-a833-d4cf4ad1e3bf',
  is_published: true
})
expect(() => buildPodcastPublishPlan(manifest, oversizedPath, apiUrl)).toThrow(/100 MiB/)
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run: `pnpm vitest run tests/podcasts/podcastPublisher.test.ts`

Expected: FAIL because `publish-podcast.ts` does not exist.

- [ ] **Step 3: Implement manifest validation and deterministic planning**

Define a Zod schema with UUID, slug, non-empty text, positive episode number, nonnegative duration, valid ISO timestamp and integer sort indexes. Reject non-`.mp3`, empty files and files larger than `104857600` bytes. Derive `storagePath` only as `${series.slug}/${episode.number padded to two digits}-${episode.slug}.mp3` and derive `audio_url` from the normalized API URL.

```ts
export function buildPodcastPublishPlan(
  manifestInput: unknown,
  audioFile: string,
  apiUrl: string
): PodcastPublishPlan {
  const manifest = podcastPublishManifestSchema.parse(manifestInput)
  const size = statSync(audioFile).size
  if (extname(audioFile).toLowerCase() !== '.mp3') throw new Error('Audio muss als MP3 vorliegen.')
  if (size === 0) throw new Error('MP3 ist leer.')
  if (size > 104_857_600) throw new Error('MP3 überschreitet das Bucket-Limit von 100 MiB.')
  const storagePath = `${manifest.series.slug}/${String(manifest.episode.number).padStart(2, '0')}-${manifest.episode.slug}.mp3`
  return createRows(manifest, resolve(audioFile), size, storagePath, apiUrl)
}
```

- [ ] **Step 4: Implement dry-run, hidden upserts, upload, publish and rollback-on-verification-failure**

Use service-role REST upserts by `id`, Storage POST with `x-upsert: true`, a public HEAD request for the MP3, then publish episode and series. Call `get_podcast_catalog` with `SUPABASE_PUBLISHABLE_KEY`; if the published IDs are missing, immediately upsert both rows back to `is_published = false` and fail. Log only target URL, IDs, storage path, size and status—never keys.

- [ ] **Step 5: Add the approved manifest and package command**

```json
{
  "legalArea": { "id": "ba7b2026-0400-4000-8000-000000000000", "slug": "oeffentliches-recht", "name": "Öffentliches Recht", "sortIndex": 20 },
  "series": { "id": "7ca1a2cc-17be-4aec-a833-d4cf4ad1e3bf", "slug": "polizei-und-sicherheitsrecht-august-2026", "title": "Polizei- und Sicherheitsrecht", "description": "Eine Lernfolge zu typischen Klausurfallen im bayerischen Polizei- und Versammlungsrecht.", "edition": "August 2026", "sortIndex": 20, "publishedAt": "2026-08-09T00:00:00.000Z" },
  "episode": { "id": "2756538a-67e2-4457-8f0e-a94764e99233", "slug": "klausurfallen-im-bayerischen-polizei-und-versammlungsrecht", "number": 1, "title": "Klausurfallen im bayerischen Polizei- und Versammlungsrecht", "description": "Typische Prüfungsprobleme und Fehlerquellen im bayerischen Polizei- und Versammlungsrecht.", "durationSeconds": 1554.969, "publishedAt": "2026-08-09T00:00:00.000Z" }
}
```

Add `"podcasts:publish": "tsx scripts/podcasts/publish-podcast.ts"` without changing the existing BayBO command.

- [ ] **Step 6: Run publisher and existing BayBO tests**

Run: `pnpm vitest run tests/podcasts/podcastPublisher.test.ts tests/podcasts/bayboPodcastSeed.test.ts`

Expected: PASS.

### Task 3: Repository skill

**Files:**
- Create: `skills/podcast-hochladen/SKILL.md`
- Create: `skills/podcast-hochladen/agents/openai.yaml`

**Interfaces:**
- Consumes: source audio, approved catalog metadata, repository publisher and local Supabase environment file.
- Produces: repeatable `$podcast-hochladen` instructions.

- [ ] **Step 1: Initialize the skill with official tooling**

Run:

```bash
python3 /Users/sbstn/.codex/skills/.system/skill-creator/scripts/init_skill.py podcast-hochladen \
  --path skills \
  --interface display_name='Podcast hochladen' \
  --interface short_description='Podcasts sicher veröffentlichen und prüfen' \
  --interface default_prompt='Use $podcast-hochladen to publish this audio file as a Jura Wolpertinger podcast.'
```

Expected: `skills/podcast-hochladen` with `SKILL.md` and `agents/openai.yaml`.

- [ ] **Step 2: Replace the template with the exact operational workflow**

Document the hierarchy, required metadata, stable IDs, MP3-only/100-MiB rules, `afinfo`, `afconvert`, catalog update, manifest, dry-run, `--apply`, hidden-first ordering, public verification, idempotent retry behavior and secret-handling constraints. Use imperative German throughout and reference the generic publisher rather than copying its TypeScript implementation.

- [ ] **Step 3: Validate skill metadata and placeholders**

Run:

```bash
python3 /Users/sbstn/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/podcast-hochladen
rg -n 'TODO|TBD|FIXME' skills/podcast-hochladen
```

Expected: validator reports success; `rg` has no matches.

### Task 4: Prepare and publish the approved audio

**Files:**
- Read: `/Users/sbstn/Downloads/Klausurfallen_im_bayerischen_Polizei-_und_Versammlungsrecht.m4a`
- Create temporarily: a unique MP3 beneath a `mktemp -d` directory
- Read credentials from: `../jura-supabase/.env`

**Interfaces:**
- Consumes: approved M4A and the manifest from Task 2.
- Produces: public MP3 object plus published Supabase series and episode.

- [ ] **Step 1: Convert without modifying the source file**

Create a unique temporary directory with `mktemp -d`, then run:

```bash
afconvert /Users/sbstn/Downloads/Klausurfallen_im_bayerischen_Polizei-_und_Versammlungsrecht.m4a "$UPLOAD_TMP/polizei-und-sicherheitsrecht.mp3" -f MPG3 -d '.mp3' -b 128000 -c 1
```

Expected: a non-empty mono MP3 below 100 MiB; the M4A remains unchanged.

- [ ] **Step 2: Inspect the converted audio**

Run: `afinfo "$UPLOAD_TMP/polizei-und-sicherheitsrecht.mp3"`

Expected: MPEG Layer 3, about 1,555 seconds, one channel, approximately 128 kbit/s.

- [ ] **Step 3: Run the publisher dry-run**

Run:

```bash
pnpm podcasts:publish -- \
  --manifest=scripts/podcasts/manifests/polizei-und-sicherheitsrecht-august-2026.json \
  --audio="$UPLOAD_TMP/polizei-und-sicherheitsrecht.mp3"
```

Expected: one legal area, one unpublished series, one unpublished episode and one MP3 upload are planned; no remote write occurs.

- [ ] **Step 4: Apply the production publication once**

Run the same command with `--apply`. Read URL, Service-Role-Key and Publishable-Key from `../jura-supabase/.env`; do not print their values.

Expected: audio upload succeeds, episode and series publish, anonymous catalog verification succeeds.

- [ ] **Step 5: Repeat the dry-run and public verification**

Run the dry-run again, call the anonymous catalog RPC, send a HEAD request to the public MP3 URL and inspect a short ranged audio response.

Expected: exactly one series and one episode with the stable IDs; HTTP 200/206 and `audio/mpeg`; no duplicate rows.

### Task 5: Final verification

**Files:**
- Verify all files from Tasks 1–3.

**Interfaces:**
- Consumes: completed implementation and live publication.
- Produces: evidence-backed handoff.

- [ ] **Step 1: Run focused tests**

Run: `pnpm vitest run tests/podcasts tests/main/services.test.ts tests/shared/schemas.test.ts tests/renderer/podcastPlayer.test.ts tests/renderer/podcastsUi.test.ts`

Expected: PASS.

- [ ] **Step 2: Run type checking**

Run: `pnpm run typecheck`

Expected: both Vue and Node TypeScript checks exit 0.

- [ ] **Step 3: Check diffs and skill validity**

Run:

```bash
git diff --check
python3 /Users/sbstn/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/podcast-hochladen
```

Expected: no whitespace errors; skill validator succeeds.

- [ ] **Step 4: Report publication evidence**

Report the final series title, episode title, legal area, public audio URL, duration, checks executed and any checks that could not run. Do not report credentials or raw environment contents.
