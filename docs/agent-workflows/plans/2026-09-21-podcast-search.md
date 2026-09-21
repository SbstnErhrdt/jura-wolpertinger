# Podcastsuche Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $subagent-driven-development (recommended) or $executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fast, accessible client-side search to the podcast library.

**Architecture:** Keep catalog loading unchanged and place normalization/filtering in a pure renderer helper. The view owns only query state, result count and empty/reset presentation.

**Tech Stack:** TypeScript, Vue 3, Nuxt UI, Vitest, Playwright.

## Global Constraints

- Search legal area, series title/description/edition and episode title/description.
- Preserve legal-area and series order.
- Keep podcast cards, links, progress and player behavior unchanged.

---

### Task 1: Podcast catalog filter

**Files:**
- Create: `src/renderer/src/ui/podcastCatalogSearch.ts`
- Create: `tests/renderer/podcastCatalogSearch.test.ts`

**Interfaces:**
- Produces: `filterPodcastCatalog(catalog: PodcastCatalog, query: string): PodcastCatalog`.
- Consumes: existing podcast catalog schema.

- [ ] Write failing tests for blank queries, diacritic-insensitive area matches, metadata matches, episode-only matches and empty results.
- [ ] Run `pnpm vitest run tests/renderer/podcastCatalogSearch.test.ts` and confirm the missing helper failure.
- [ ] Implement normalization and immutable grouped filtering.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Search user interface

**Files:**
- Modify: `src/renderer/src/views/PodcastsView.vue`
- Modify: `src/renderer/src/styles/main.css`
- Modify: `tests/renderer/podcastsUi.test.ts`
- Modify: `docs/user-stories.md`

**Interfaces:**
- Consumes: `filterPodcastCatalog`.
- Produces: labeled search field, reset action, live result count and distinct empty state.

- [ ] Add failing UI contract assertions for the search label, placeholder, result count, reset action and empty-state copy.
- [ ] Run `pnpm vitest run tests/renderer/podcastsUi.test.ts` and confirm failure.
- [ ] Integrate computed filtered areas/counts and accessible search markup without changing catalog loading.
- [ ] Add responsive styles aligned with the collection-search pattern and update the podcast user story.
- [ ] Re-run the focused tests and typecheck; confirm they pass.
- [ ] Commit the search feature.

### Task 3: Browser flow

**Files:**
- Modify: `tests/e2e/app.e2e.spec.ts`

**Interfaces:**
- Consumes: podcast search UI and existing series route.
- Produces: regression coverage for searching and opening a series.

- [ ] Add an E2E flow that searches by episode/topic, verifies grouped results, resets, and opens a resulting series.
- [ ] Run the focused Playwright test and confirm it passes without console errors or horizontal overflow.
