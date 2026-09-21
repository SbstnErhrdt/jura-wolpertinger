# Frameless Podcast Artwork Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $subagent-driven-development (recommended) or $executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the blue inset frame from real podcast artwork and enlarge overview covers moderately without changing the fallback tile or card behavior.

**Architecture:** `PodcastArtwork.vue` exposes the existing image/fallback state as a conditional CSS class. Existing renderer CSS uses that class for full-bleed artwork and adjusts only the overview grid widths. A source-contract test protects the desktop, mobile, and fallback distinctions.

**Tech Stack:** Vue 3, TypeScript, CSS, Vitest, Electron Vite

## Global Constraints

- Real artwork is full-bleed with no blue background, border, or padding.
- Desktop cover width is exactly `144px`; mobile cover width is exactly `104px`.
- The fallback remains blue, bordered, and padded.
- Existing rounded corners, `object-fit: cover`, progress UI, links, and card spacing remain intact.
- Preserve all unrelated uncommitted work; do not stage or commit implementation files that already contain broader changes.

---

### Task 1: Add the frameless artwork state and moderate sizing

**Files:**
- Modify: `tests/renderer/podcastsUi.test.ts`
- Modify: `src/renderer/src/components/PodcastArtwork.vue`
- Modify: `src/renderer/src/styles/main.css`

**Interfaces:**
- Consumes: `artworkUrl: string | null`, `showFallback: Ref<boolean>`
- Produces: conditional class `podcast-cover-has-artwork` on `.podcast-cover`

- [ ] **Step 1: Write the failing renderer contract test**

Extend the artwork test with these assertions:

```ts
expect(artwork).toContain("'podcast-cover-has-artwork': artworkUrl && !showFallback")
expect(styles).toMatch(
  /\.podcast-cover-has-artwork\s*\{[^}]*background:\s*transparent;[^}]*border:\s*0;[^}]*padding:\s*0;/
)
expect(styles).toMatch(
  /\.podcast-series-card \[data-slot='container'\]\s*\{[^}]*grid-template-columns:\s*144px minmax\(0, 1fr\)/
)
expect(styles).toMatch(
  /@media[^}]+\{[\s\S]*?\.podcast-series-card \[data-slot='container'\]\s*\{[^}]*grid-template-columns:\s*104px minmax\(0, 1fr\)/
)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
corepack pnpm vitest run tests/renderer/podcastsUi.test.ts
```

Expected: FAIL because the conditional class and `144px`/`104px` rules do not exist.

- [ ] **Step 3: Implement the smallest Vue and CSS change**

Change the component class binding to:

```vue
<div
  class="podcast-cover"
  :class="{
    'podcast-cover-large': large,
    'podcast-cover-has-artwork': artworkUrl && !showFallback
  }"
  aria-hidden="true"
>
```

Change the desktop overview grid width to `144px`, add:

```css
.podcast-cover-has-artwork {
  background: transparent;
  border: 0;
  padding: 0;
}
```

and change the existing mobile overview width to `104px`. Leave base `.podcast-cover` fallback styling untouched.

- [ ] **Step 4: Run focused tests and typecheck**

Run:

```bash
corepack pnpm vitest run tests/renderer/podcastsUi.test.ts tests/shared/podcastProgress.test.ts
corepack pnpm run typecheck
```

Expected: all tests pass and typecheck exits `0`.

### Task 2: Build, visually verify, and deploy the web UI

**Files:**
- Verify: `out/renderer/`
- Deploy: `server.02:/home/docker-compose/jura-wolpi/app/`

**Interfaces:**
- Consumes: production `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_JURA_REQUIRE_AUTH=1`
- Produces: updated static production web bundle

- [ ] **Step 1: Build with the production web configuration**

Retrieve only `ANON_KEY` from the configured production environment without printing it, then run:

```bash
VITE_JURA_REQUIRE_AUTH=1 \
VITE_SUPABASE_URL=https://app.jura-wolpi.de/api \
VITE_SUPABASE_ANON_KEY="$podcast_anon_key" \
corepack pnpm run build:web:production
```

Expected: production environment verification, typecheck, and build all exit `0`.

- [ ] **Step 2: Verify desktop and mobile presentation**

Run a local no-auth renderer and inspect `/#/podcasts` at normal desktop width and at the existing mobile breakpoint. Confirm real artwork is full-bleed, proportionate, and uncropped beyond square `object-fit: cover`; confirm the fallback remains unchanged.

- [ ] **Step 3: Deploy the verified renderer**

Run:

```bash
rsync -az --delete out/renderer/ server.02:/home/docker-compose/jura-wolpi/app/
```

Expected: exit `0` with no credential output.

- [ ] **Step 4: Verify the public build**

Check that `https://app.jura-wolpi.de/` returns `200`, the live index references the newly built JavaScript and CSS assets, and the seven public podcast cover URLs still return `200 image/png`.

- [ ] **Step 5: Review the final diff**

Run:

```bash
git diff --check
git status --short --branch
```

Expected: no whitespace errors, no credential files, and only intended edits plus pre-existing worktree changes.

