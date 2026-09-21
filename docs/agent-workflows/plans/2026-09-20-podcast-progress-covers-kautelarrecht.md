# Podcast Progress, Wolpi Artwork, and Kautelarrecht Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $subagent-driven-development (recommended) or $executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the Kautelarrecht podcast, give every podcast series a thematic Wolpi cover, and show accessible duration-weighted progress on the podcast overview.

**Architecture:** A pure shared helper derives listened percentage and completed episodes from the existing private episode progress. A focused Vue artwork component renders `artworkUrl` with the current blue Jura-Audio tile as its fallback. Cover images are generated as square PNG assets, published idempotently by a small tested artwork publisher, and referenced by both the local catalog and Supabase.

**Tech Stack:** Vue 3, TypeScript, Vitest, Zod, Supabase REST/Storage, built-in ImageGen, FFmpeg, Electron Vite.

## Global Constraints

- Preserve every pre-existing uncommitted change; never reset or overwrite unrelated work.
- Use `corepack pnpm` because the repository pins pnpm 10.33.0.
- The progress percentage is duration-weighted; completed episodes count with full catalog duration.
- Every cover is square, text-free, and uses the existing Wolpi identity without official logos or sovereign insignia.
- Store final artwork in `src/renderer/public/assets/podcast-covers/` and publish each file as its concrete series slug followed by `/cover.png` in the public `podcast-audio` bucket.
- Keep the M4A source unchanged; upload only a verified mono MP3 near 128 kbit/s and below 100 MiB.
- Never print, commit, or place Supabase credentials in Markdown or renderer code.
- Do not deploy until local tests, typecheck, build, asset checks, and production dry runs pass.
- Because relevant files already contain uncommitted user work, commit only a hunk proven to contain exclusively this plan's changes; otherwise leave implementation changes uncommitted.

---

### Task 1: Duration-weighted series progress

**Files:**
- Create: `tests/shared/podcastProgress.test.ts`
- Modify: `src/shared/podcastProgress.ts`

**Interfaces:**
- Consumes: `PodcastEpisode[]` from `src/shared/schemas.ts`.
- Produces: `calculatePodcastSeriesProgress(episodes: PodcastEpisode[]): { completedEpisodes: number; totalEpisodes: number; listenedSeconds: number; durationSeconds: number; percentage: number }`.

- [ ] **Step 1: Write the failing unit tests**

Cover an empty series, a 50%-heard episode, one completed plus one 25%-heard episode, an overlong position clamped to duration, and zero-duration episodes. Assert integer percentages rounded with `Math.round`.

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm vitest run tests/shared/podcastProgress.test.ts`

Expected: FAIL because `calculatePodcastSeriesProgress` is not exported.

- [ ] **Step 3: Implement the minimal helper**

For each episode, use `Math.max(0, episode.durationSeconds)`. A completed episode contributes that full duration; otherwise clamp `progress.positionSeconds` into `[0, duration]`. Sum durations and listened seconds, count `progress.completed`, and return zero percent when total duration is zero.

- [ ] **Step 4: Verify GREEN**

Run: `corepack pnpm vitest run tests/shared/podcastProgress.test.ts tests/renderer/podcastPlayer.test.ts`

Expected: both test files pass.

### Task 2: Consistent cover and progress UI

**Files:**
- Create: `src/renderer/src/components/PodcastArtwork.vue`
- Modify: `src/renderer/src/views/PodcastsView.vue`
- Modify: `src/renderer/src/views/PodcastSeriesView.vue`
- Modify: `src/renderer/src/styles/main.css`
- Modify: `tests/renderer/podcastsUi.test.ts`
- Modify: `src/renderer/src/views/HelpView.vue`
- Modify: `docs/user-stories.md`

**Interfaces:**
- Consumes: `calculatePodcastSeriesProgress` from Task 1 and `PodcastSeries.artworkUrl`.
- Produces: `PodcastArtwork` with props `{ artworkUrl: string | null; title: string; large?: boolean }`, plus an overview progressbar per series.

- [ ] **Step 1: Extend the UI contract test before production code**

Assert that the overview imports `calculatePodcastSeriesProgress`, renders `role="progressbar"`, exposes `aria-valuenow`, and includes the wording `Folgen abgeschlossen`. Assert both views render `<PodcastArtwork` and the component contains an `@error` fallback plus `/assets/icon.png`.

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm vitest run tests/renderer/podcastsUi.test.ts`

Expected: FAIL on the missing component and progressbar expectations.

- [ ] **Step 3: Add the artwork component**

Render the remote image while it is available. On its first `error` event, switch to the existing blue `.podcast-cover` content with `/assets/icon.png` and `Jura Audio`. Mark the image decorative because the adjacent heading already names the series. Apply `.podcast-cover-large` when `large` is true.

- [ ] **Step 4: Add the overview progress block**

Below the series description, render a caption with `completedEpisodes`, correct singular/plural, and `percentage`. Render a seven-pixel rounded track with `role="progressbar"`, `aria-valuemin="0"`, `aria-valuemax="100"`, numeric `aria-valuenow`, and an `aria-valuetext` combining title, percentage, and completion count. Reuse the flashcard collection colors and add a light-blue dark-mode fill.

- [ ] **Step 5: Reuse artwork on the detail page and document behavior**

Replace the duplicated detail placeholder with `PodcastArtwork`. Add a Help FAQ explaining that the bar measures listened time while the completion count only includes finished episodes. Add the same acceptance rule to `docs/user-stories.md`.

- [ ] **Step 6: Verify GREEN**

Run: `corepack pnpm vitest run tests/renderer/podcastsUi.test.ts tests/shared/podcastProgress.test.ts tests/renderer/podcastPlayer.test.ts`

Expected: all tests pass.

### Task 3: Idempotent artwork publisher

**Files:**
- Create: `scripts/podcasts/publish-podcast-artwork.ts`
- Create: `tests/podcasts/podcastArtworkPublisher.test.ts`
- Modify: `package.json`
- Modify: `skills/podcast-hochladen/SKILL.md`

**Interfaces:**
- Consumes: series ID, series slug, PNG path, production API URL, service-role key, and anonymous key.
- Produces: a public URL under `https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio/`, followed by the validated series slug and `/cover.png`, and updates `podcast_series.artwork_url`.

- [ ] **Step 1: Write failing publisher tests**

Test plan validation for UUID, slug, `.png`, nonempty file, and a 10 MiB limit. Test request order: upload with `image/png` and `x-upsert: true`, public HEAD verification, REST PATCH by exact series ID, then anonymous `get_podcast_catalog` verification of the same URL. Test dry-run formatting without remote calls.

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm vitest run tests/podcasts/podcastArtworkPublisher.test.ts`

Expected: FAIL because the artwork publisher module is absent.

- [ ] **Step 3: Implement the publisher and command**

Add `podcasts:publish-artwork` to `package.json`. The CLI accepts `--url`, `--series-id`, `--series-slug`, `--image`, and optional `--apply`. Resolve credentials through the existing `resolvePodcastPublishCredentials`. Without `--apply`, print only series slug, public path, size, and target URL. With `--apply`, execute the tested request order and never print secrets.

- [ ] **Step 4: Update the project upload skill**

Document generation, repository location, dry run, idempotent cover upload, public MIME verification, `artworkUrl` consistency, and fallback behavior. Keep audio publication rules unchanged.

- [ ] **Step 5: Verify GREEN and skill structure**

Run:

```bash
corepack pnpm vitest run tests/podcasts/podcastArtworkPublisher.test.ts tests/podcasts/podcastPublisher.test.ts
python3 /Users/sbstn/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/podcast-hochladen
```

Expected: tests pass and validation prints `Skill is valid!`.

### Task 4: Generate and install seven Wolpi covers

**Files:**
- Create: `src/renderer/public/assets/podcast-covers/baybo-april-2026.png`
- Create: `src/renderer/public/assets/podcast-covers/kommunalrecht-august-2026.png`
- Create: `src/renderer/public/assets/podcast-covers/polizei-und-sicherheitsrecht-august-2026.png`
- Create: `src/renderer/public/assets/podcast-covers/steuerrecht-ao-august-2026.png`
- Create: `src/renderer/public/assets/podcast-covers/uebersichtssammlung-strafrecht-august-2026.png`
- Create: `src/renderer/public/assets/podcast-covers/vorlaeufiger-rechtsschutz-august-2026.png`
- Create: `src/renderer/public/assets/podcast-covers/kautelarrecht-september-2026.png`

**Interfaces:**
- Consumes: the canonical Wolpi reference `assets/wolpi/ChatGPT Image 12. Juli 2026, 16_47_22 (1).png`.
- Produces: seven square PNG files with no embedded text.

- [ ] **Step 1: Generate one image per series with built-in ImageGen**

Use `stylized-concept` and the same identity constraints in every prompt: friendly Wolpi with warm brown fur, oversized rabbit ears, small golden antlers, feathered wings, fluffy tail, navy-and-gold paragraph scarf, polished storybook illustration, centered square album art, deep blue and warm gold palette, no text, no watermark, no logo, no sovereign insignia. Vary only the thematic scene and props listed in the design specification.

- [ ] **Step 2: Inspect every generated image**

Use `view_image` and reject any image that loses the mascot identity, contains text, crops ears/antlers, introduces an official insignia, or is not thematically distinct. Regenerate only the failed asset with one targeted prompt correction.

- [ ] **Step 3: Copy final outputs into the workspace**

Use the exact filenames above; do not overwrite source references under `assets/wolpi`.

- [ ] **Step 4: Verify asset shape and type**

Run: `file src/renderer/public/assets/podcast-covers/*.png` and `sips -g pixelWidth -g pixelHeight src/renderer/public/assets/podcast-covers/*.png`.

Expected: seven PNG images, each square and at least 1024×1024.

### Task 5: Add Kautelarrecht test-first and assign artwork URLs

**Files:**
- Create: `tests/podcasts/kautelarrechtPodcast.test.ts`
- Create: `src/shared/podcasts/kautelarrecht-september-2026.ts`
- Create: `scripts/podcasts/manifests/kautelarrecht-september-2026.json`
- Modify: `src/shared/podcasts/catalog.ts`
- Modify: every existing file in `src/shared/podcasts/*.ts` that defines a series
- Modify: existing JSON manifests under `scripts/podcasts/manifests/`

**Interfaces:**
- Produces legal-area ID `172b38f6-bf72-4b1b-9af4-f7d1e7337728`, series ID `4d7c41fc-5785-4f0a-baad-22906dbc97bc`, and episode ID `7eb18ca2-364b-46b2-89e5-db7a1a24a38f`.
- Produces series slug `kautelarrecht-september-2026` and episode slug `kautelarrecht-von-erbrecht-bis-mopeg`.

- [ ] **Step 1: Write the failing catalog/manifest test**

Assert `Zivilrecht → Kautelarrecht → Kautelarrecht von Erbrecht bis MoPeG`, September 2026, the exact stable IDs/slugs, the measured converted duration rounded to at most three decimals, and the audio/cover public URLs. For every catalog series, assert `artworkUrl` equals the declared public artwork base plus `series.slug` plus `/cover.png`.

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm vitest run tests/podcasts/kautelarrechtPodcast.test.ts`

Expected: FAIL because the Kautelarrecht module is absent.

- [ ] **Step 3: Convert and verify audio without touching the source**

Set `podcast_tmp_dir="$(mktemp -d)"`, resolve FFmpeg or install `imageio-ffmpeg>=0.6,<1` only there, convert to mono MP3 at 128 kbit/s as `$podcast_tmp_dir/kautelarrecht.mp3`, and verify MPEG Layer 3, duration, and size with `afinfo`. Use the measured MP3 duration in test, catalog, and manifest.

- [ ] **Step 4: Implement the catalog and manifest**

Use legal-area sort index 0, series sort index 10, publication `2026-09-20T00:00:00.000Z`, the description `Eine Lernreihe zu kautelarjuristischen Gestaltungsfragen zwischen Erbrecht, Gesellschaftsrecht und MoPeG.` and episode description `Kautelarrechtliche Gestaltung von erbrechtlichen Ausgangslagen bis zu den Neuerungen des MoPeG.` Add the catalog import. Assign every existing series its matching public cover URL and mirror it into its upload manifest when available.

- [ ] **Step 5: Verify GREEN**

Run: `corepack pnpm vitest run tests/podcasts/kautelarrechtPodcast.test.ts tests/podcasts tests/main/services.test.ts`

Expected: all podcast and service tests pass.

### Task 6: Publish artwork and Kautelarrecht

**Files:** No additional source files.

**Interfaces:** Uses the verified artwork publisher, podcast publisher, final PNGs, manifest, and temporary MP3.

- [ ] **Step 1: Run seven artwork dry runs**

Run these exact commands and confirm each public path, PNG size, and production URL:

```bash
corepack pnpm podcasts:publish-artwork -- --url=https://app.jura-wolpi.de/api --series-id=ba7b2026-0400-4000-8000-000000000001 --series-slug=baybo-april-2026 --image=src/renderer/public/assets/podcast-covers/baybo-april-2026.png
corepack pnpm podcasts:publish-artwork -- --url=https://app.jura-wolpi.de/api --series-id=9f143318-0db6-4993-8678-dee3beac0b57 --series-slug=kommunalrecht-august-2026 --image=src/renderer/public/assets/podcast-covers/kommunalrecht-august-2026.png
corepack pnpm podcasts:publish-artwork -- --url=https://app.jura-wolpi.de/api --series-id=7ca1a2cc-17be-4aec-a833-d4cf4ad1e3bf --series-slug=polizei-und-sicherheitsrecht-august-2026 --image=src/renderer/public/assets/podcast-covers/polizei-und-sicherheitsrecht-august-2026.png
corepack pnpm podcasts:publish-artwork -- --url=https://app.jura-wolpi.de/api --series-id=7be6edfa-9c51-48b0-9dde-53f5de29420f --series-slug=steuerrecht-ao-august-2026 --image=src/renderer/public/assets/podcast-covers/steuerrecht-ao-august-2026.png
corepack pnpm podcasts:publish-artwork -- --url=https://app.jura-wolpi.de/api --series-id=a33d4dc5-48d4-448a-99be-77b7f8868d5c --series-slug=uebersichtssammlung-strafrecht-august-2026 --image=src/renderer/public/assets/podcast-covers/uebersichtssammlung-strafrecht-august-2026.png
corepack pnpm podcasts:publish-artwork -- --url=https://app.jura-wolpi.de/api --series-id=e78242ec-0550-4a37-a7ad-ca740b139762 --series-slug=vorlaeufiger-rechtsschutz-august-2026 --image=src/renderer/public/assets/podcast-covers/vorlaeufiger-rechtsschutz-august-2026.png
corepack pnpm podcasts:publish-artwork -- --url=https://app.jura-wolpi.de/api --series-id=4d7c41fc-5785-4f0a-baad-22906dbc97bc --series-slug=kautelarrecht-september-2026 --image=src/renderer/public/assets/podcast-covers/kautelarrecht-september-2026.png
```

- [ ] **Step 2: Run the podcast dry run**

Run `corepack pnpm podcasts:publish -- --url=https://app.jura-wolpi.de/api --manifest=scripts/podcasts/manifests/kautelarrecht-september-2026.json --audio="$podcast_tmp_dir/kautelarrecht.mp3"` and confirm series, episode 1, storage path, size, and production URL.

- [ ] **Step 3: Publish artwork idempotently**

Read only `SERVICE_ROLE_KEY` and `ANON_KEY` from `server.02:/home/docker-compose/jura-supabase-wolpi/.env` into process variables without printing them. Run each exact artwork command once with `--apply`.

- [ ] **Step 4: Publish the new podcast once**

Pass the same process variables to the exact podcast command with `--apply`.

- [ ] **Step 5: Verify public storage and anonymous catalog**

For all seven cover URLs expect HEAD 200 and `image/png`. For the MP3 expect HEAD 200 `audio/mpeg` and Range 0-1023 to return 206. Query anonymous `get_podcast_catalog`; assert seven expected artwork URLs and exactly one new series/episode by the stable IDs.

### Task 7: Build, deploy, and verify the web UI

**Files:** No additional source files unless verification finds a defect, which must begin with a failing regression test.

- [ ] **Step 1: Run complete local verification**

Run:

```bash
corepack pnpm vitest run tests/podcasts tests/shared/podcastProgress.test.ts tests/main/services.test.ts tests/shared/schemas.test.ts tests/renderer/podcastPlayer.test.ts tests/renderer/podcastsUi.test.ts
corepack pnpm run typecheck
corepack pnpm run build
python3 /Users/sbstn/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/podcast-hochladen
git diff --check
```

Expected: zero failures, successful build, valid skill, and no whitespace errors.

- [ ] **Step 2: Build with production Supabase configuration**

Follow `deployment.md`: read the production public URL/key securely, export only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the build process, and rebuild `out/renderer`.

- [ ] **Step 3: Deploy the static renderer**

Use `rsync -az --delete out/renderer/ server.02:/home/docker-compose/jura-wolpi/app/`, confirm the server compose status, and reload only the nginx service if required by `deployment.md`.

- [ ] **Step 4: Verify desktop and mobile UI**

Open the production podcast page with an authenticated browser session. At desktop width and a mobile breakpoint, verify thematic covers, fallback absence, progress caption, percentage, bar width, light/dark contrast, navigation into a series, and the new Kautelarrecht card. Inspect the accessibility tree for `progressbar` name/value.

- [ ] **Step 5: Preserve sources and clean temporary conversion files recoverably**

Confirm the original M4A still exists, then move the unique conversion directory to the macOS Trash with an explicit non-colliding name. Report that this temporary directory is recoverable.
