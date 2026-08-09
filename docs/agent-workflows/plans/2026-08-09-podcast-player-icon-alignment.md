# Podcast Player Icon Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $subagent-driven-development (recommended) or $executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Center every transport, play and pause icon in the podcast UI without changing text, row layout, dimensions or player behavior.

**Architecture:** Add one shared presentation class to the existing Nuxt UI buttons in `PodcastPlayer.vue` and `PodcastSeriesView.vue`. Keep all behavior in the current components and implement the correction in the existing renderer stylesheet, including deterministic overlay positioning for the `15` and `30` labels and a one-pixel optical correction for Play.

**Tech Stack:** Vue 3, Nuxt UI 4, Lucide Vue, CSS, Vitest, Electron/Vite

## Global Constraints

- Do not change titles, descriptions, episode rows, metadata, responsive wrapping, button dimensions, colors, spacing, labels or click behavior.
- Add no component abstraction and no dependency.
- Render only the podcast controls for the focused visual verification.
- Preserve every unrelated worktree change.

---

### Task 1: Lock the alignment contract with a failing renderer test

**Files:**
- Modify: `tests/renderer/podcastsUi.test.ts`

**Interfaces:**
- Consumes: Source markup from `src/renderer/src/components/PodcastPlayer.vue`, `src/renderer/src/views/PodcastSeriesView.vue` and CSS from `src/renderer/src/styles/main.css`.
- Produces: A regression contract for the shared `podcast-icon-control` class, centered SVG layout, centered seconds overlay and Play optical correction.

- [ ] **Step 1: Extend the existing UI source contract**

Add this test inside the existing `describe('podcast UI', ...)` block:

```ts
it('centers transport and play icons independently from Nuxt UI defaults', async () => {
  const player = await readFile(resolve(rendererRoot, 'components/PodcastPlayer.vue'), 'utf8')
  const series = await readFile(resolve(rendererRoot, 'views/PodcastSeriesView.vue'), 'utf8')
  const styles = await readFile(resolve(rendererRoot, 'styles/main.css'), 'utf8')

  expect(player.match(/podcast-icon-control/g)).toHaveLength(6)
  expect(series).toContain('podcast-icon-control podcast-episode-play')
  expect(styles).toMatch(/\.podcast-icon-control\s*\{[^}]*align-items:\s*center/)
  expect(styles).toMatch(/\.podcast-icon-control\s*>\s*svg\s*\{[^}]*display:\s*block/)
  expect(styles).toMatch(/\.podcast-wide-control span\s*\{[^}]*inset:\s*0/)
  expect(styles).toMatch(/\.podcast-icon-control\s*>\s*\.lucide-play\s*\{[^}]*translateX\(1px\)/)
})
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
pnpm vitest run tests/renderer/podcastsUi.test.ts
```

Expected: FAIL because the shared class and deterministic alignment rules do not exist yet.

---

### Task 2: Center the podcast icons with the smallest implementation

**Files:**
- Modify: `src/renderer/src/components/PodcastPlayer.vue`
- Modify: `src/renderer/src/views/PodcastSeriesView.vue`
- Modify: `src/renderer/src/styles/main.css`

**Interfaces:**
- Consumes: Existing `UButton` markup and the regression contract from Task 1.
- Produces: The shared CSS hook `podcast-icon-control`; no TypeScript or runtime API changes.

- [ ] **Step 1: Mark only the affected buttons**

Add `podcast-icon-control` to the five transport controls and the expand control in `PodcastPlayer.vue`. Keep the existing purpose-specific classes, for example:

```vue
class="podcast-icon-control podcast-secondary-control podcast-wide-control"
```

Add the same shared class to the episode button in `PodcastSeriesView.vue`:

```vue
class="podcast-icon-control podcast-episode-play"
```

- [ ] **Step 2: Add deterministic alignment rules**

Add these rules beside the existing podcast control styles in `main.css`:

```css
.podcast-icon-control {
  align-items: center;
  box-sizing: border-box;
  display: inline-flex;
  justify-content: center;
  line-height: 0;
  position: relative;
}

.podcast-icon-control > svg {
  display: block;
  flex: 0 0 auto;
}

.podcast-icon-control > .lucide-play {
  transform: translateX(1px);
}
```

Replace the current `.podcast-wide-control span` rule with:

```css
.podcast-wide-control span {
  display: grid;
  font-size: 9px;
  font-weight: 800;
  inset: 0;
  line-height: 1;
  place-items: center;
  pointer-events: none;
  position: absolute;
}
```

- [ ] **Step 3: Run the focused test and confirm GREEN**

Run:

```bash
pnpm vitest run tests/renderer/podcastsUi.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run the podcast regression set and typecheck**

Run:

```bash
pnpm vitest run tests/renderer/podcastsUi.test.ts tests/renderer/podcastPlayer.test.ts
pnpm run typecheck
```

Expected: All tests and both TypeScript projects pass.

---

### Task 3: Render and inspect the real component locally

**Files:**
- No committed file changes.

**Interfaces:**
- Consumes: The actual renderer components and CSS through the local Vite/Electron development server.
- Produces: Visual evidence for the player controls in Play and Pause state; no repository artifact.

- [ ] **Step 1: Start the local app renderer**

Run:

```bash
pnpm dev
```

Expected: Electron Vite prints its local renderer URL and starts the app.

- [ ] **Step 2: Inspect only the affected controls**

Open the local podcast series, start one episode and capture the `.podcast-player-transport` and one `.podcast-episode-play` button. Verify that:

- Skip, Pause and expand symbols share the same visual center.
- `15` and `30` sit at the center of their circle arrows.
- After toggling playback, the Play triangle is optically centered.
- Control sizes and spacing match the unchanged design.

- [ ] **Step 3: Stop the local development process**

Send an interrupt to the development process after the screenshots and computed-position checks are complete.

---

### Task 4: Commit the focused UI change

**Files:**
- Modify: `tests/renderer/podcastsUi.test.ts`
- Modify: `src/renderer/src/components/PodcastPlayer.vue`
- Modify: `src/renderer/src/views/PodcastSeriesView.vue`
- Modify: `src/renderer/src/styles/main.css`

**Interfaces:**
- Consumes: Passing targeted tests, passing typecheck and visual confirmation from Tasks 1-3.
- Produces: One reviewable commit containing only the icon-alignment regression test and implementation.

- [ ] **Step 1: Check the scoped diff**

Run:

```bash
git diff --check -- tests/renderer/podcastsUi.test.ts src/renderer/src/components/PodcastPlayer.vue src/renderer/src/views/PodcastSeriesView.vue src/renderer/src/styles/main.css
git diff -- tests/renderer/podcastsUi.test.ts src/renderer/src/components/PodcastPlayer.vue src/renderer/src/views/PodcastSeriesView.vue src/renderer/src/styles/main.css
```

Expected: Only the shared button class, alignment CSS and regression test are present alongside any pre-existing user changes in those files.

- [ ] **Step 2: Commit only the focused hunks**

Stage only the Task 1-2 hunks, then run:

```bash
git commit -m "fix: align podcast player icons"
```

Expected: The commit contains no unrelated worktree changes.
