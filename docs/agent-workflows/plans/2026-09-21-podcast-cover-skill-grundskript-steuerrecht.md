# Podcast-Cover-Skill und Grundskript Steuerrecht Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $subagent-driven-development (recommended) or $executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Einen wiederverwendbaren Projekt-Skill fuer performante Jura-Wolpi-Podcast-Cover erstellen, alle vorhandenen Cover optimieren und die neue Reihe **Grundskript Steuerrecht** mit ihrer ersten Einkommensteuer-Folge samt Cover produktiv veroeffentlichen.

**Architecture:** Der neue Projekt-Skill kapselt Motivwahl, ImageGen-Vorgaben, Wolpi-Identitaet, technische PNG-Optimierung und Thumbnail-Pruefung. Die neue Reihe folgt dem vorhandenen statischen Podcast-Katalog plus JSON-Manifest; Audio und Cover werden mit den bestehenden idempotenten Supabase-Publishern veroeffentlicht. Die Vue-Komponente laedt entfernte Cover verzögert und dekodiert sie asynchron.

**Tech Stack:** Codex project skills, built-in ImageGen, ImageMagick, Bash, Vue 3, TypeScript, Vitest, Zod, FFmpeg/imageio-ffmpeg, Supabase REST/Storage, Electron Vite.

## Global Constraints

- Preserve every pre-existing uncommitted change; never reset or overwrite unrelated work.
- Use `corepack pnpm` because the repository pins pnpm 10.33.0.
- The project skill lives at `.agents/skills/podcast-cover-erstellen/` beside the existing project skills.
- Every podcast cover is text-free, contains no logo, watermark, official seal, coat of arms, real form, or sovereign insignia, and preserves the canonical Wolpi identity.
- Every final cover is a square 1024 x 1024 PNG with at most 256 colors, a target size of at most 600 KB, and a hard limit of 800 KB.
- Store final artwork at `src/renderer/public/assets/podcast-covers/<series-slug>.png` and publish it to `<series-slug>/cover.png` in the public `podcast-audio` bucket.
- Keep the M4A source unchanged; publish only the verified mono MP3 at approximately 128 kbit/s and below 100 MiB.
- Use stable series ID `7d61a370-ece1-4c4a-a613-3b2c00707fce` and episode ID `2abfbda4-e81d-4e31-b518-d319bf56c391` throughout catalog, manifest, storage, and verification.
- Publish the series under existing legal area ID `b19ffd85-c38c-43a3-870b-63ca52331d70`, slug `steuerrecht`, name `Steuerrecht`, sort index `30`.
- Never print, commit, or place Supabase credentials in Markdown, source code, renderer code, or command output.
- Do not deploy until focused tests, complete podcast tests, typecheck, production build, skill validation, asset checks, and production dry runs pass.
- Because relevant files already contain uncommitted user work, commit only new files or an exact hunk proven to contain exclusively this plan's changes; otherwise leave the implementation change uncommitted.

---

### Task 1: Create the project podcast-cover skill

**Files:**
- Create: `.agents/skills/podcast-cover-erstellen/SKILL.md`
- Create: `.agents/skills/podcast-cover-erstellen/scripts/optimize-cover.sh`

**Interfaces:**
- Consumes: a series title, episode context, a generated or existing raster image, existing artwork in `src/renderer/public/assets/podcast-covers/`, and the canonical Wolpi reference under `assets/wolpi/`.
- Produces: `optimize-cover.sh <input-image> <output.png>` and a validated 1024 x 1024 PNG below 800 KB at the canonical series path.

- [ ] **Step 1: Write the skill instructions**

Create `.agents/skills/podcast-cover-erstellen/SKILL.md` with this complete content:

```markdown
---
name: podcast-cover-erstellen
description: Erstellt oder ueberarbeitet konsistente, performante Podcast-Cover fuer Jura Wolpertinger. Verwenden, wenn ein thematisches Wolpi-Cover fuer eine Podcast-Reihe erzeugt, visuell geprueft, als PNG optimiert oder fuer den Podcast-Upload vorbereitet werden soll. Nicht fuer Audio-Konvertierung, Podcast-Metadaten oder allgemeine Marketinggrafiken verwenden.
---

# Podcast-Cover erstellen

## Grenzen

Dieser Skill verantwortet Motiv, Bildgenerierung, Wolpi-Konsistenz, lokale Ablage und PNG-Optimierung. Fuer Audio, Katalog, Manifest und Produktionsveroeffentlichung gilt `skills/podcast-hochladen/SKILL.md`.

## 1. Bestand und Identitaet pruefen

1. Lies Reihentitel, Episodenthema und Ausgabe.
2. Pruefe die vorhandenen Cover unter `src/renderer/public/assets/podcast-covers/`.
3. Nutze ein passendes Bild aus `assets/wolpi/` als visuelle Identitaetsreferenz.
4. Erhalte warmes braunes Fell, uebergrosse Hasenohren, kleines goldenes Geweih, gefiederte Fluegel, buschigen Schweif und das blau-goldene Paragrafen-Halstuch.

## 2. Eine klare Bildmetapher waehlen

Leite aus der Reihe eine einzige, auf 104 bis 144 Pixel Kantenlaenge erkennbare Bildmetapher ab. Gesicht und Hauptrequisite liegen im sicheren mittleren Bildbereich. Vermeide duenne Details und wichtige Elemente direkt am Rand.

Grenze verwandte Reihen durch unterschiedliche Metaphern ab. Verwende keine Schrift, Zahlenkolonnen, echten Formulare, Logos, Wasserzeichen, Wappen, Siegel oder sonstige Hoheitszeichen.

## 3. Mit ImageGen erzeugen

Nutze das eingebaute Bildmodell mit der kanonischen Wolpi-Referenz. Fordere quadratische, vollflaechige Album-Art im polierten Storybook-Stil mit tiefem Blau und warmem Gold an. Der Prompt nennt Thema, zentrale Metapher, Wolpi-Merkmale, Thumbnail-Komposition und alle Ausschluesse. Erzeuge keine Beschriftung im Bild.

Pruefe das Ergebnis mit `view_image`. Verwirf es, wenn Wolpi nicht wiedererkennbar ist, Ohren oder Geweih abgeschnitten sind, Schrift oder Hoheitszeichen erscheinen oder die Metapher in Thumbnail-Groesse unklar bleibt.

## 4. Ablage und Optimierung

Der Zielpfad lautet immer:

```text
src/renderer/public/assets/podcast-covers/<reihen-slug>.png
```

Optimiere das ausgewaehlte Bild mit:

```bash
.agents/skills/podcast-cover-erstellen/scripts/optimize-cover.sh \
  "/absoluter/pfad/zum/eingangsbild" \
  "src/renderer/public/assets/podcast-covers/<reihen-slug>.png"
```

Das Skript normalisiert auf 1024 x 1024 Pixel, entfernt Metadaten und versucht 256, 192 und 128 Farben. Ziel sind hoechstens 600 KB; mehr als 800 KB ist ungueltig. Unterschaerfe oder sichtbare Banding-Artefakte sind trotz bestandener Groessenpruefung ein Ablehnungsgrund.

## 5. Abschlusspruefung

1. Pruefe mit `file` und `magick identify`, dass die Datei ein quadratisches PNG mit exakt 1024 x 1024 Pixeln ist.
2. Pruefe mit `stat`, dass sie nicht groesser als 819200 Bytes ist.
3. Oeffne das finale PNG erneut und pruefe es in voller Groesse sowie als Thumbnail.
4. Uebergib danach Reihen-Slug, Serien-ID und Cover-Pfad an `skills/podcast-hochladen/SKILL.md`.

Der oeffentliche Pfad bleibt `<reihen-slug>/cover.png`; die Katalog-URL endet entsprechend auf `/<reihen-slug>/cover.png`.
```

- [ ] **Step 2: Add the deterministic optimizer**

Create `.agents/skills/podcast-cover-erstellen/scripts/optimize-cover.sh` with this content and mark it executable:

```bash
#!/usr/bin/env bash
set -euo pipefail

input_path="${1:?Eingangsbild fehlt}"
output_path="${2:?Ausgabe-PNG fehlt}"
target_bytes=614400
hard_limit_bytes=819200

command -v magick >/dev/null || {
  echo "ImageMagick (magick) fehlt." >&2
  exit 1
}
test -f "$input_path" || {
  echo "Eingangsbild fehlt: $input_path" >&2
  exit 1
}

output_dir="$(dirname "$output_path")"
mkdir -p "$output_dir"
work_dir="$(mktemp -d "${TMPDIR:-/tmp}/podcast-cover.XXXXXX")"
trap 'rm -rf "$work_dir"' EXIT

selected=""
for colors in 256 192 128; do
  candidate="$work_dir/cover-${colors}.png"
  magick "$input_path" -auto-orient -resize '1024x1024^' \
    -gravity center -extent 1024x1024 -strip -colors "$colors" "PNG8:$candidate"
  size="$(stat -f '%z' "$candidate")"
  selected="$candidate"
  if [ "$size" -le "$target_bytes" ]; then
    break
  fi
done

size="$(stat -f '%z' "$selected")"
if [ "$size" -gt "$hard_limit_bytes" ]; then
  echo "Optimiertes Cover ist mit ${size} Bytes groesser als 800 KB." >&2
  exit 1
fi

dimensions="$(magick identify -format '%wx%h' "$selected")"
test "$dimensions" = "1024x1024" || {
  echo "Unerwartete Abmessungen: $dimensions" >&2
  exit 1
}

cp "$selected" "$output_path"
echo "$output_path ($dimensions, $size Bytes)"
```

Run: `chmod +x .agents/skills/podcast-cover-erstellen/scripts/optimize-cover.sh`

- [ ] **Step 3: Validate the optimizer on a temporary output**

Run:

```bash
cover_test_dir="$(mktemp -d)"
.agents/skills/podcast-cover-erstellen/scripts/optimize-cover.sh \
  src/renderer/public/assets/podcast-covers/steuerrecht-ao-august-2026.png \
  "$cover_test_dir/cover.png"
file "$cover_test_dir/cover.png"
magick identify -format '%wx%h\n' "$cover_test_dir/cover.png"
test "$(stat -f '%z' "$cover_test_dir/cover.png")" -le 819200
```

Expected: `PNG image data`, `1024x1024`, and exit status 0.

- [ ] **Step 4: Validate and then read the new skill before using it**

Run:

```bash
python3 /Users/sbstn/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  .agents/skills/podcast-cover-erstellen
cat .agents/skills/podcast-cover-erstellen/SKILL.md
```

Expected: `Skill is valid!` and the complete skill text. From this point forward, explicitly announce whenever the new skill causes generation, optimization, inspection, or a pause.

- [ ] **Step 5: Commit the isolated skill files**

```bash
git add .agents/skills/podcast-cover-erstellen/SKILL.md \
  .agents/skills/podcast-cover-erstellen/scripts/optimize-cover.sh
git commit -m "feat: add podcast cover project skill"
```

Expected: the commit contains only the new project skill and optimizer.

---

### Task 2: Add deferred artwork loading

**Files:**
- Modify: `tests/renderer/podcastsUi.test.ts:45-73`
- Modify: `src/renderer/src/components/PodcastArtwork.vue:10-16`

**Interfaces:**
- Consumes: existing `PodcastArtwork` props and fallback behavior.
- Produces: remote cover images with native `loading="lazy"` and `decoding="async"`; fallback markup remains unchanged.

- [ ] **Step 1: Extend the UI contract test before production code**

Add these assertions beside the existing artwork expectations in `tests/renderer/podcastsUi.test.ts`:

```ts
expect(artwork).toContain('loading="lazy"')
expect(artwork).toContain('decoding="async"')
```

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm vitest run tests/renderer/podcastsUi.test.ts`

Expected: FAIL because `PodcastArtwork.vue` does not yet contain the two attributes.

- [ ] **Step 3: Add the browser loading hints**

Change the artwork `<img>` block to:

```vue
<img
  v-if="artworkUrl && !showFallback"
  class="podcast-artwork-image"
  :src="artworkUrl"
  alt=""
  loading="lazy"
  decoding="async"
  @error="showFallback = true"
/>
```

- [ ] **Step 4: Verify GREEN**

Run: `corepack pnpm vitest run tests/renderer/podcastsUi.test.ts`

Expected: all tests in the file pass.

- [ ] **Step 5: Preserve the dirty worktree boundary**

Inspect only the affected hunk with `git diff -- tests/renderer/podcastsUi.test.ts src/renderer/src/components/PodcastArtwork.vue`. Commit only if both files contain no earlier uncommitted user work; otherwise leave them uncommitted and record the passing test.

---

### Task 3: Add Grundskript Steuerrecht test-first and prepare its audio

**Files:**
- Create: `tests/podcasts/grundskriptSteuerrechtPodcast.test.ts`
- Create: `src/shared/podcasts/grundskript-steuerrecht-april-2026.ts`
- Create: `scripts/podcasts/manifests/grundskript-steuerrecht-april-2026.json`
- Modify: `src/shared/podcasts/catalog.ts`

**Interfaces:**
- Produces: `GRUNDSKRIPT_STEUERRECHT_SERIES_ID`, `GRUNDSKRIPT_STEUERRECHT_EPISODE_ID`, `GRUNDSKRIPT_STEUERRECHT_SLUG`, and `GRUNDSKRIPT_STEUERRECHT_PODCAST_CATALOG`.
- Produces public audio path `grundskript-steuerrecht-april-2026/01-systematik-des-einkommensteuerrechts-im-zweiten-staatsexamen.mp3` and artwork path `grundskript-steuerrecht-april-2026/cover.png`.

- [ ] **Step 1: Write the failing catalog and manifest test**

Create `tests/podcasts/grundskriptSteuerrechtPodcast.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PODCAST_CATALOG } from '@shared/podcasts/catalog'
import {
  GRUNDSKRIPT_STEUERRECHT_EPISODE_ID,
  GRUNDSKRIPT_STEUERRECHT_PODCAST_CATALOG,
  GRUNDSKRIPT_STEUERRECHT_SERIES_ID,
  GRUNDSKRIPT_STEUERRECHT_SLUG
} from '@shared/podcasts/grundskript-steuerrecht-april-2026'

const MEDIA_BASE =
  'https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio'
const MANIFEST_PATH =
  'scripts/podcasts/manifests/grundskript-steuerrecht-april-2026.json'

describe('Grundskript Steuerrecht podcast', () => {
  it('adds the April 2026 series to Steuerrecht with stable public media', () => {
    const area = GRUNDSKRIPT_STEUERRECHT_PODCAST_CATALOG.legalAreas[0]
    const series = area.series[0]
    const episode = series.episodes[0]

    expect(area).toMatchObject({ slug: 'steuerrecht', name: 'Steuerrecht' })
    expect(series).toMatchObject({
      id: '7d61a370-ece1-4c4a-a613-3b2c00707fce',
      slug: 'grundskript-steuerrecht-april-2026',
      title: 'Grundskript Steuerrecht',
      edition: 'April 2026',
      artworkUrl: `${MEDIA_BASE}/grundskript-steuerrecht-april-2026/cover.png`
    })
    expect(episode).toMatchObject({
      id: '2abfbda4-e81d-4e31-b518-d319bf56c391',
      seriesId: GRUNDSKRIPT_STEUERRECHT_SERIES_ID,
      slug: 'systematik-des-einkommensteuerrechts-im-zweiten-staatsexamen',
      number: 1,
      title: 'Systematik des Einkommensteuerrechts im zweiten Staatsexamen',
      durationSeconds: 1740.487,
      audioUrl:
        `${MEDIA_BASE}/${GRUNDSKRIPT_STEUERRECHT_SLUG}/` +
        '01-systematik-des-einkommensteuerrechts-im-zweiten-staatsexamen.mp3'
    })
    expect(GRUNDSKRIPT_STEUERRECHT_EPISODE_ID).toBe(episode.id)
    const mergedArea = PODCAST_CATALOG.legalAreas.find(
      (candidate) => candidate.slug === 'steuerrecht'
    )
    expect(mergedArea?.series).toContainEqual(series)
  })

  it('keeps manifest and catalog metadata aligned', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
    const series = GRUNDSKRIPT_STEUERRECHT_PODCAST_CATALOG.legalAreas[0].series[0]
    const episode = series.episodes[0]

    expect(manifest.legalArea).toEqual({
      id: 'b19ffd85-c38c-43a3-870b-63ca52331d70',
      slug: 'steuerrecht',
      name: 'Steuerrecht',
      sortIndex: 30
    })
    expect(manifest.series).toMatchObject({
      id: series.id,
      slug: series.slug,
      title: series.title,
      description: series.description,
      edition: series.edition,
      artworkUrl: series.artworkUrl,
      sortIndex: 20,
      publishedAt: '2026-09-21T00:00:00.000Z'
    })
    expect(manifest.episode).toMatchObject({
      id: episode.id,
      slug: episode.slug,
      number: episode.number,
      title: episode.title,
      description: episode.description,
      durationSeconds: episode.durationSeconds,
      publishedAt: episode.publishedAt
    })
  })
})
```

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm vitest run tests/podcasts/grundskriptSteuerrechtPodcast.test.ts`

Expected: FAIL because the Grundskript module and manifest do not exist.

- [ ] **Step 3: Convert and verify the source without modifying it**

Run:

```bash
podcast_tmp_dir="$(mktemp -d /tmp/grundskript-steuerrecht.XXXXXX)"
podcast_ffmpeg_path="$(command -v ffmpeg || true)"
if [ -z "$podcast_ffmpeg_path" ]; then
  python3 -m pip install --disable-pip-version-check \
    --target "$podcast_tmp_dir/pydeps" 'imageio-ffmpeg>=0.6,<1'
  podcast_ffmpeg_path="$(PYTHONPATH="$podcast_tmp_dir/pydeps" python3 -c \
    'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())')"
fi
"$podcast_ffmpeg_path" -hide_banner -loglevel error -y \
  -i /Users/sbstn/Downloads/Systematik_des_Einkommensteuerrechts_im_zweiten_Staatsexamen.m4a \
  -vn -ac 1 -codec:a libmp3lame -b:a 128k \
  "$podcast_tmp_dir/grundskript-steuerrecht.mp3"
afinfo "$podcast_tmp_dir/grundskript-steuerrecht.mp3"
stat -f '%z' "$podcast_tmp_dir/grundskript-steuerrecht.mp3"
```

Expected: MPG3, one 44.1 kHz channel, approximately 127999 bit/s, duration `1740.486531` seconds, and `27848338` bytes. Round the catalog duration to `1740.487`.

- [ ] **Step 4: Implement the focused catalog module**

Create `src/shared/podcasts/grundskript-steuerrecht-april-2026.ts`:

```ts
import type { PodcastCatalog } from '../schemas'

export const GRUNDSKRIPT_STEUERRECHT_SERIES_ID =
  '7d61a370-ece1-4c4a-a613-3b2c00707fce'
export const GRUNDSKRIPT_STEUERRECHT_EPISODE_ID =
  '2abfbda4-e81d-4e31-b518-d319bf56c391'
export const GRUNDSKRIPT_STEUERRECHT_SLUG =
  'grundskript-steuerrecht-april-2026'

const EPISODE_SLUG =
  'systematik-des-einkommensteuerrechts-im-zweiten-staatsexamen'
const MEDIA_BASE =
  'https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio'

export const GRUNDSKRIPT_STEUERRECHT_PODCAST_CATALOG: PodcastCatalog = {
  legalAreas: [
    {
      slug: 'steuerrecht',
      name: 'Steuerrecht',
      series: [
        {
          id: GRUNDSKRIPT_STEUERRECHT_SERIES_ID,
          slug: GRUNDSKRIPT_STEUERRECHT_SLUG,
          title: 'Grundskript Steuerrecht',
          description:
            'Eine klausurorientierte Lernreihe zu den Grundlagen und zur Systematik des Steuerrechts im zweiten Staatsexamen.',
          edition: 'April 2026',
          artworkUrl: `${MEDIA_BASE}/${GRUNDSKRIPT_STEUERRECHT_SLUG}/cover.png`,
          episodes: [
            {
              id: GRUNDSKRIPT_STEUERRECHT_EPISODE_ID,
              seriesId: GRUNDSKRIPT_STEUERRECHT_SERIES_ID,
              slug: EPISODE_SLUG,
              number: 1,
              title: 'Systematik des Einkommensteuerrechts im zweiten Staatsexamen',
              description:
                'Die Systematik des Einkommensteuerrechts als Einstieg in das Grundskript Steuerrecht.',
              durationSeconds: 1740.487,
              audioUrl:
                `${MEDIA_BASE}/${GRUNDSKRIPT_STEUERRECHT_SLUG}/01-${EPISODE_SLUG}.mp3`,
              publishedAt: '2026-09-21T00:00:00.000Z',
              progress: null
            }
          ]
        }
      ]
    }
  ]
}
```

- [ ] **Step 5: Add the exact upload manifest**

Create `scripts/podcasts/manifests/grundskript-steuerrecht-april-2026.json`:

```json
{
  "legalArea": {
    "id": "b19ffd85-c38c-43a3-870b-63ca52331d70",
    "slug": "steuerrecht",
    "name": "Steuerrecht",
    "sortIndex": 30
  },
  "series": {
    "id": "7d61a370-ece1-4c4a-a613-3b2c00707fce",
    "slug": "grundskript-steuerrecht-april-2026",
    "title": "Grundskript Steuerrecht",
    "description": "Eine klausurorientierte Lernreihe zu den Grundlagen und zur Systematik des Steuerrechts im zweiten Staatsexamen.",
    "edition": "April 2026",
    "artworkUrl": "https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio/grundskript-steuerrecht-april-2026/cover.png",
    "sortIndex": 20,
    "publishedAt": "2026-09-21T00:00:00.000Z"
  },
  "episode": {
    "id": "2abfbda4-e81d-4e31-b518-d319bf56c391",
    "slug": "systematik-des-einkommensteuerrechts-im-zweiten-staatsexamen",
    "number": 1,
    "title": "Systematik des Einkommensteuerrechts im zweiten Staatsexamen",
    "description": "Die Systematik des Einkommensteuerrechts als Einstieg in das Grundskript Steuerrecht.",
    "durationSeconds": 1740.487,
    "publishedAt": "2026-09-21T00:00:00.000Z"
  }
}
```

- [ ] **Step 6: Aggregate the new series**

Add this import to `src/shared/podcasts/catalog.ts`:

```ts
import { GRUNDSKRIPT_STEUERRECHT_PODCAST_CATALOG } from './grundskript-steuerrecht-april-2026'
```

Add `GRUNDSKRIPT_STEUERRECHT_PODCAST_CATALOG` immediately after `STEUERRECHT_AO_PODCAST_CATALOG` in the `mergePodcastCatalogs` input array.

- [ ] **Step 7: Verify GREEN**

Run:

```bash
corepack pnpm vitest run \
  tests/podcasts/grundskriptSteuerrechtPodcast.test.ts \
  tests/podcasts/podcastPublisher.test.ts \
  tests/main/services.test.ts
```

Expected: all tests pass.

- [ ] **Step 8: Commit only isolated new files and a clean catalog hunk**

Stage the test, module, and manifest. Stage the two catalog lines only if the hunk contains no earlier user changes; otherwise leave `catalog.ts` unstaged.

```bash
git add tests/podcasts/grundskriptSteuerrechtPodcast.test.ts \
  src/shared/podcasts/grundskript-steuerrecht-april-2026.ts \
  scripts/podcasts/manifests/grundskript-steuerrecht-april-2026.json
git commit -m "feat: add Grundskript Steuerrecht podcast metadata"
```

Expected: no unrelated pre-existing changes enter the commit.

---

### Task 4: Generate the new cover and optimize all podcast artwork

**Files:**
- Create: `src/renderer/public/assets/podcast-covers/grundskript-steuerrecht-april-2026.png`
- Modify: `src/renderer/public/assets/podcast-covers/baybo-april-2026.png`
- Modify: `src/renderer/public/assets/podcast-covers/kautelarrecht-september-2026.png`
- Modify: `src/renderer/public/assets/podcast-covers/kommunalrecht-august-2026.png`
- Modify: `src/renderer/public/assets/podcast-covers/polizei-und-sicherheitsrecht-august-2026.png`
- Modify: `src/renderer/public/assets/podcast-covers/steuerrecht-ao-august-2026.png`
- Modify: `src/renderer/public/assets/podcast-covers/uebersichtssammlung-strafrecht-august-2026.png`
- Modify: `src/renderer/public/assets/podcast-covers/vorlaeufiger-rechtsschutz-august-2026.png`

**Interfaces:**
- Consumes: `.agents/skills/podcast-cover-erstellen/SKILL.md`, its optimizer, and canonical Wolpi reference `assets/wolpi/ChatGPT Image 12. Juli 2026, 16_47_22 (1).png`.
- Produces: eight visually checked, square 1024 x 1024 PNG files, each at most 800 KB.

- [ ] **Step 1: Announce use of the new skill and generate the tax-system cover**

Use built-in ImageGen with the canonical Wolpi reference and this exact prompt:

```text
Create square full-bleed podcast album artwork in the same polished, warm storybook illustration style as the reference mascot. Show the recognizable friendly Jura Wolpi with warm brown fur, very large rabbit ears, small golden antlers, feathered wings, a fluffy squirrel-like tail, and a navy-blue and gold neckerchief with a paragraph symbol. Wolpi sits at an elegant tax-law study desk. Use one clear visual metaphor for the system of German income tax: three distinct streams of neutral symbolic objects representing employment, renting property, and business converge neatly into one central organized tax calculation folder and calculator. The scene should communicate structure, classification, and exam-ready understanding, distinct from a mechanical Abgabenordnung motif. Deep navy blue and warm gold palette, expressive face, central composition, readable at 104–144 px, safe margin around ears and antlers, rich but uncluttered background. No text, no letters, no readable numbers, no logos, no watermark, no coat of arms, no seal, no official insignia, no real government form.
```

Inspect the generated output with `view_image`. Regenerate only if Wolpi identity, crop, prohibited marks, or thumbnail readability fails.

- [ ] **Step 2: Optimize the selected new image into the repository**

Set `generated_cover_path` to the absolute local output path returned by ImageGen, verify it exists, and run the new skill's optimizer:

```bash
test -f "$generated_cover_path"
.agents/skills/podcast-cover-erstellen/scripts/optimize-cover.sh \
  "$generated_cover_path" \
  src/renderer/public/assets/podcast-covers/grundskript-steuerrecht-april-2026.png
```

Expected: a 1024 x 1024 PNG no larger than 819200 bytes.

- [ ] **Step 3: Optimize each existing cover in place through a temporary file**

Run:

```bash
cover_dir=src/renderer/public/assets/podcast-covers
for cover_name in \
  baybo-april-2026.png \
  kautelarrecht-september-2026.png \
  kommunalrecht-august-2026.png \
  polizei-und-sicherheitsrecht-august-2026.png \
  steuerrecht-ao-august-2026.png \
  uebersichtssammlung-strafrecht-august-2026.png \
  vorlaeufiger-rechtsschutz-august-2026.png
do
  .agents/skills/podcast-cover-erstellen/scripts/optimize-cover.sh \
    "$cover_dir/$cover_name" "$cover_dir/$cover_name"
done
```

Expected: all seven commands succeed without changing filenames or public URLs.

- [ ] **Step 4: Verify file type, dimensions, size, and visual consistency**

Run:

```bash
file src/renderer/public/assets/podcast-covers/*.png
magick identify -format '%f %wx%h %b\n' \
  src/renderer/public/assets/podcast-covers/*.png
for cover in src/renderer/public/assets/podcast-covers/*.png; do
  test "$(stat -f '%z' "$cover")" -le 819200
done
```

Expected: eight PNG files, every one exactly 1024 x 1024 and at most 800 KB. Open every optimized image with `view_image`; also create a temporary 144-pixel contact sheet and reject visible banding, unreadable motifs, text, or official marks.

- [ ] **Step 5: Commit only the new cover when existing artwork is pre-existing untracked work**

Use `git status --short -- src/renderer/public/assets/podcast-covers`. Commit `grundskript-steuerrecht-april-2026.png` only if Git can isolate it from earlier uncommitted cover work; otherwise leave the complete artwork directory uncommitted rather than absorbing unrelated assets.

---

### Task 5: Verify, publish, deploy, and inspect production

**Files:** No additional source files unless verification finds a defect. Any defect fix starts with a focused failing regression test.

**Interfaces:**
- Consumes: the verified manifest, temporary MP3, eight final PNGs, existing audio/artwork publishers, and production public configuration.
- Produces: the live Grundskript Steuerrecht series, eight optimized public covers under stable URLs, and a web renderer with native deferred image loading.

- [ ] **Step 1: Run complete local verification before external writes**

Run:

```bash
corepack pnpm vitest run \
  tests/podcasts \
  tests/main/services.test.ts \
  tests/shared/schemas.test.ts \
  tests/renderer/podcastPlayer.test.ts \
  tests/renderer/podcastsUi.test.ts
corepack pnpm run typecheck
python3 /Users/sbstn/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  .agents/skills/podcast-cover-erstellen
python3 /Users/sbstn/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  skills/podcast-hochladen
git diff --check
```

Expected: zero test/type/validation/whitespace failures.

- [ ] **Step 2: Run the production podcast dry run**

Run:

```bash
corepack pnpm podcasts:publish -- \
  --url=https://app.jura-wolpi.de/api \
  --manifest=scripts/podcasts/manifests/grundskript-steuerrecht-april-2026.json \
  --audio="$podcast_tmp_dir/grundskript-steuerrecht.mp3"
```

Expected: `Grundskript Steuerrecht`, episode 1, a 26.6 MB MP3 at `grundskript-steuerrecht-april-2026/01-systematik-des-einkommensteuerrechts-im-zweiten-staatsexamen.mp3`, and the production API URL.

- [ ] **Step 3: Run all eight artwork dry runs**

Run:

```bash
corepack pnpm podcasts:publish-artwork -- --url=https://app.jura-wolpi.de/api --series-id=ba7b2026-0400-4000-8000-000000000001 --series-slug=baybo-april-2026 --image=src/renderer/public/assets/podcast-covers/baybo-april-2026.png
corepack pnpm podcasts:publish-artwork -- --url=https://app.jura-wolpi.de/api --series-id=4d7c41fc-5785-4f0a-baad-22906dbc97bc --series-slug=kautelarrecht-september-2026 --image=src/renderer/public/assets/podcast-covers/kautelarrecht-september-2026.png
corepack pnpm podcasts:publish-artwork -- --url=https://app.jura-wolpi.de/api --series-id=9f143318-0db6-4993-8678-dee3beac0b57 --series-slug=kommunalrecht-august-2026 --image=src/renderer/public/assets/podcast-covers/kommunalrecht-august-2026.png
corepack pnpm podcasts:publish-artwork -- --url=https://app.jura-wolpi.de/api --series-id=7ca1a2cc-17be-4aec-a833-d4cf4ad1e3bf --series-slug=polizei-und-sicherheitsrecht-august-2026 --image=src/renderer/public/assets/podcast-covers/polizei-und-sicherheitsrecht-august-2026.png
corepack pnpm podcasts:publish-artwork -- --url=https://app.jura-wolpi.de/api --series-id=7be6edfa-9c51-48b0-9dde-53f5de29420f --series-slug=steuerrecht-ao-august-2026 --image=src/renderer/public/assets/podcast-covers/steuerrecht-ao-august-2026.png
corepack pnpm podcasts:publish-artwork -- --url=https://app.jura-wolpi.de/api --series-id=a33d4dc5-48d4-448a-99be-77b7f8868d5c --series-slug=uebersichtssammlung-strafrecht-august-2026 --image=src/renderer/public/assets/podcast-covers/uebersichtssammlung-strafrecht-august-2026.png
corepack pnpm podcasts:publish-artwork -- --url=https://app.jura-wolpi.de/api --series-id=e78242ec-0550-4a37-a7ad-ca740b139762 --series-slug=vorlaeufiger-rechtsschutz-august-2026 --image=src/renderer/public/assets/podcast-covers/vorlaeufiger-rechtsschutz-august-2026.png
corepack pnpm podcasts:publish-artwork -- --url=https://app.jura-wolpi.de/api --series-id=7d61a370-ece1-4c4a-a613-3b2c00707fce --series-slug=grundskript-steuerrecht-april-2026 --image=src/renderer/public/assets/podcast-covers/grundskript-steuerrecht-april-2026.png
```

Expected: each dry run reports its stable `<series-slug>/cover.png`, a size below 0.8 MB, and `https://app.jura-wolpi.de/api`.

- [ ] **Step 4: Read only the two required production credentials**

Run without printing either value:

```bash
podcast_service_role_key="$(ssh server.02 'cd /home/docker-compose/jura-supabase-wolpi && awk -F= '\''$1 == "SERVICE_ROLE_KEY" { print substr($0,index($0,"=")+1); exit }'\'' .env')"
podcast_anon_key="$(ssh server.02 'cd /home/docker-compose/jura-supabase-wolpi && awk -F= '\''$1 == "ANON_KEY" { print substr($0,index($0,"=")+1); exit }'\'' .env')"
test -n "$podcast_service_role_key"
test -n "$podcast_anon_key"
```

Expected: both `test` commands exit 0 and no secret appears in output.

- [ ] **Step 5: Publish the new podcast exactly once**

Run:

```bash
SERVICE_ROLE_KEY="$podcast_service_role_key" ANON_KEY="$podcast_anon_key" \
corepack pnpm podcasts:publish -- \
  --url=https://app.jura-wolpi.de/api \
  --manifest=scripts/podcasts/manifests/grundskript-steuerrecht-april-2026.json \
  --audio="$podcast_tmp_dir/grundskript-steuerrecht.mp3" \
  --apply
```

Expected: the publisher reports the series, episode, and public MP3 URL after its own public catalog check.

- [ ] **Step 6: Upsert the seven optimized existing covers and then the new cover**

Run each publication command exactly once in this order:

```bash
SERVICE_ROLE_KEY="$podcast_service_role_key" ANON_KEY="$podcast_anon_key" \
corepack pnpm podcasts:publish-artwork -- --url=https://app.jura-wolpi.de/api --series-id=ba7b2026-0400-4000-8000-000000000001 --series-slug=baybo-april-2026 --image=src/renderer/public/assets/podcast-covers/baybo-april-2026.png --apply
SERVICE_ROLE_KEY="$podcast_service_role_key" ANON_KEY="$podcast_anon_key" \
corepack pnpm podcasts:publish-artwork -- --url=https://app.jura-wolpi.de/api --series-id=4d7c41fc-5785-4f0a-baad-22906dbc97bc --series-slug=kautelarrecht-september-2026 --image=src/renderer/public/assets/podcast-covers/kautelarrecht-september-2026.png --apply
SERVICE_ROLE_KEY="$podcast_service_role_key" ANON_KEY="$podcast_anon_key" \
corepack pnpm podcasts:publish-artwork -- --url=https://app.jura-wolpi.de/api --series-id=9f143318-0db6-4993-8678-dee3beac0b57 --series-slug=kommunalrecht-august-2026 --image=src/renderer/public/assets/podcast-covers/kommunalrecht-august-2026.png --apply
SERVICE_ROLE_KEY="$podcast_service_role_key" ANON_KEY="$podcast_anon_key" \
corepack pnpm podcasts:publish-artwork -- --url=https://app.jura-wolpi.de/api --series-id=7ca1a2cc-17be-4aec-a833-d4cf4ad1e3bf --series-slug=polizei-und-sicherheitsrecht-august-2026 --image=src/renderer/public/assets/podcast-covers/polizei-und-sicherheitsrecht-august-2026.png --apply
SERVICE_ROLE_KEY="$podcast_service_role_key" ANON_KEY="$podcast_anon_key" \
corepack pnpm podcasts:publish-artwork -- --url=https://app.jura-wolpi.de/api --series-id=7be6edfa-9c51-48b0-9dde-53f5de29420f --series-slug=steuerrecht-ao-august-2026 --image=src/renderer/public/assets/podcast-covers/steuerrecht-ao-august-2026.png --apply
SERVICE_ROLE_KEY="$podcast_service_role_key" ANON_KEY="$podcast_anon_key" \
corepack pnpm podcasts:publish-artwork -- --url=https://app.jura-wolpi.de/api --series-id=a33d4dc5-48d4-448a-99be-77b7f8868d5c --series-slug=uebersichtssammlung-strafrecht-august-2026 --image=src/renderer/public/assets/podcast-covers/uebersichtssammlung-strafrecht-august-2026.png --apply
SERVICE_ROLE_KEY="$podcast_service_role_key" ANON_KEY="$podcast_anon_key" \
corepack pnpm podcasts:publish-artwork -- --url=https://app.jura-wolpi.de/api --series-id=e78242ec-0550-4a37-a7ad-ca740b139762 --series-slug=vorlaeufiger-rechtsschutz-august-2026 --image=src/renderer/public/assets/podcast-covers/vorlaeufiger-rechtsschutz-august-2026.png --apply
SERVICE_ROLE_KEY="$podcast_service_role_key" ANON_KEY="$podcast_anon_key" \
corepack pnpm podcasts:publish-artwork -- --url=https://app.jura-wolpi.de/api --series-id=7d61a370-ece1-4c4a-a613-3b2c00707fce --series-slug=grundskript-steuerrecht-april-2026 --image=src/renderer/public/assets/podcast-covers/grundskript-steuerrecht-april-2026.png --apply
```

Expected: every command verifies its public `image/png` object and matching anonymous catalog URL.

- [ ] **Step 7: Build and deploy the renderer with production public configuration**

Run:

```bash
VITE_SUPABASE_URL=https://app.jura-wolpi.de/api \
VITE_SUPABASE_ANON_KEY="$podcast_anon_key" \
corepack pnpm run build:web:production
rsync -az --delete out/renderer/ server.02:/home/docker-compose/jura-wolpi/app/
ssh server.02 'cd /home/docker-compose/jura-wolpi && docker compose ps'
curl -fsS https://app.jura-wolpi.de/ >/dev/null
curl -I -fsS https://app.jura-wolpi.de/
```

Expected: successful production build and sync, healthy containers, and HTTP 200 from the public app.

- [ ] **Step 8: Verify public media and catalog without service-role context**

Run anonymous HEAD checks for all eight cover URLs and the new MP3, then query the public catalog with only `ANON_KEY`:

```bash
media_base=https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio
for cover_slug in \
  baybo-april-2026 \
  kautelarrecht-september-2026 \
  kommunalrecht-august-2026 \
  polizei-und-sicherheitsrecht-august-2026 \
  steuerrecht-ao-august-2026 \
  uebersichtssammlung-strafrecht-august-2026 \
  vorlaeufiger-rechtsschutz-august-2026 \
  grundskript-steuerrecht-april-2026
do
  cover_headers="$(curl -fsSI "$media_base/$cover_slug/cover.png" | tr -d '\r')"
  printf '%s\n' "$cover_headers" | rg -i '^content-type: image/png'
  cover_length="$(printf '%s\n' "$cover_headers" | awk 'BEGIN{IGNORECASE=1} /^content-length:/ {print $2; exit}')"
  test -n "$cover_length"
  test "$cover_length" -le 819200
done

episode_url="$media_base/grundskript-steuerrecht-april-2026/01-systematik-des-einkommensteuerrechts-im-zweiten-staatsexamen.mp3"
curl -fsSI "$episode_url" | tr -d '\r' | rg -i '^content-type: audio/mpeg'
test "$(curl -fsS -o /dev/null -w '%{http_code}' -H 'Range: bytes=0-1023' "$episode_url")" = "206"

curl -fsS -X POST https://app.jura-wolpi.de/api/rest/v1/rpc/get_podcast_catalog \
  -H "apikey: $podcast_anon_key" \
  -H "Authorization: Bearer $podcast_anon_key" \
  -H 'Content-Type: application/json' \
  --data '{}' | node -e '
let body = ""
process.stdin.setEncoding("utf8")
process.stdin.on("data", (chunk) => { body += chunk })
process.stdin.on("end", () => {
  const catalog = JSON.parse(body)
  const series = catalog.legalAreas
    .flatMap((area) => area.series ?? [])
    .filter((item) => item.id === "7d61a370-ece1-4c4a-a613-3b2c00707fce")
  if (series.length !== 1) throw new Error(`expected one series, got ${series.length}`)
  const episode = series[0].episodes?.filter(
    (item) => item.id === "2abfbda4-e81d-4e31-b518-d319bf56c391"
  ) ?? []
  if (episode.length !== 1) throw new Error(`expected one episode, got ${episode.length}`)
  const base = "https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio/grundskript-steuerrecht-april-2026"
  if (series[0].artworkUrl !== `${base}/cover.png`) throw new Error("artwork URL mismatch")
  if (episode[0].audioUrl !== `${base}/01-systematik-des-einkommensteuerrechts-im-zweiten-staatsexamen.mp3`) throw new Error("audio URL mismatch")
})
'
```

Expected: HTTP 200 for each cover and MP3 HEAD request, `image/png` for covers, `audio/mpeg` for the episode, every cover `Content-Length` below 819200, byte-range status 206, and no catalog assertion error.

- [ ] **Step 9: Inspect the production UI and playback**

Open `https://app.jura-wolpi.de/#/podcasts` in an authenticated browser session. At desktop and mobile widths verify:

- the new card appears under **Steuerrecht** as **Grundskript Steuerrecht**;
- the optimized covers render without frames, banding, or fallback tiles;
- cover proportions and sizes remain consistent;
- deferred loading does not leave visible cards blank after scrolling;
- the series page shows the correct episode, edition, and progress UI;
- playback starts, seeking to a later position works, and the reported duration is approximately 29:00.

Use the accessibility tree or rendered DOM to confirm the cover image contains `loading="lazy"` and `decoding="async"`.

- [ ] **Step 10: Final repository and source safety audit**

Run:

```bash
test -f /Users/sbstn/Downloads/Systematik_des_Einkommensteuerrechts_im_zweiten_Staatsexamen.m4a
git diff --check
git status --short
```

Expected: the original M4A still exists, no whitespace errors, no credentials or temporary MP3s are tracked, and every unrelated dirty-worktree change remains intact. Move only the unique temporary conversion directory to the macOS Trash after all production verification succeeds; report that it remains recoverable.
