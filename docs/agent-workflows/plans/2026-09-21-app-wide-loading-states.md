# Appweite Ladezustände Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $subagent-driven-development (recommended) or $executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alle datenabhängigen App-Oberflächen unterscheiden Erstladung, echte Null-/Leerwerte, Hintergrundaktualisierung, laufende Aktionen und Fehler sichtbar sowie zugänglich.

**Architecture:** Eine kleine `AppLoadingState`-Komponente vereinheitlicht Statussemantik und nimmt ansichtsspezifische Skeleton-Geometrie per Slot auf. Die Ansichten behalten ihre lokalen Datenzustände und ergänzen nur explizite `loading`, `refreshing`, `error` und aktionsbezogene Busy-Flags; bereits geladene Daten bleiben bei Aktualisierungen sichtbar.

**Tech Stack:** Vue 3 Composition API, TypeScript, Nuxt UI 4 (`USkeleton`, `UAlert`, `UButton`), Vitest-Quellverträge, Playwright/Axe.

## Global Constraints

- Keine neue Abhängigkeit und kein globaler Async-State-Store.
- Echte Null- und Leerwerte erscheinen erst nach erfolgreicher Ladung.
- Vollflächen-Lader nur während des App-Bootstraps; Seiten verwenden lokale Skeletons.
- Hintergrundaktualisierungen halten valide Daten sichtbar und setzen `aria-busy`.
- Aktions-Lader sperren nur die auslösende und unmittelbar kollidierende Aktion.
- Alle Texte sind deutsch und nicht-technisch; heller und dunkler Modus bleiben funktionsfähig.
- Produktionscode entsteht erst nach einem fokussierten, erwartbar fehlschlagenden Test.

---

### Task 1: Gemeinsamer zugänglicher Ladebaustein

**Files:**
- Create: `src/renderer/src/components/ui/AppLoadingState.vue`
- Modify: `src/renderer/src/styles/main.css`
- Create: `tests/renderer/loadingStatesUi.test.ts`

**Interfaces:**
- Produces: `AppLoadingState` with required prop `label: string` and default slot for view-specific `USkeleton` markup.
- Semantics: outer region uses `role="status"`, `aria-live="polite"`, `aria-busy="true"`; slot wrapper uses `aria-hidden="true"`.

- [ ] **Step 1: Write the failing component contract test**

```ts
it('provides one accessible loading wrapper for view-shaped skeletons', async () => {
  const source = await readFile(resolve(rendererRoot, 'components/ui/AppLoadingState.vue'), 'utf8')
  expect(source).toContain("label: string")
  expect(source).toContain('role="status"')
  expect(source).toContain('aria-live="polite"')
  expect(source).toContain('aria-busy="true"')
  expect(source).toContain('aria-hidden="true"')
  expect(source).toContain('<slot />')
})
```

- [ ] **Step 2: Run RED**

Run: `corepack pnpm exec vitest run tests/renderer/loadingStatesUi.test.ts`
Expected: FAIL because `AppLoadingState.vue` does not exist.

- [ ] **Step 3: Implement the component and shared styles**

```vue
<template>
  <div class="app-loading-state" role="status" aria-live="polite" aria-busy="true">
    <span class="visually-hidden">{{ label }}</span>
    <div class="app-loading-state-content" aria-hidden="true"><slot /></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ label: string }>()
</script>
```

Add stable width, grid and reduced-motion rules without overriding individual skeleton geometry.

- [ ] **Step 4: Run GREEN and commit**

Run: `corepack pnpm exec vitest run tests/renderer/loadingStatesUi.test.ts`
Expected: PASS.

Commit: `feat: add accessible loading state component`

### Task 2: App-Bootstrap and Home without placeholder data

**Files:**
- Modify: `src/renderer/src/App.vue`
- Modify: `src/renderer/src/views/HomeView.vue`
- Modify: `src/renderer/src/styles/main.css`
- Modify: `tests/renderer/loadingStatesUi.test.ts`
- Modify: `tests/renderer/homeUi.test.ts`

**Interfaces:**
- App state: `bootstrapStatus: 'loading' | 'ready' | 'error'`, `bootstrapError: string`, `bootstrapApp(): Promise<void>`.
- Home state: `loading`, `loadError`, `loadHome(): Promise<void>`; dashboard cards render only when `dashboard !== null`.

- [ ] **Step 1: Add failing tests**

```ts
expect(app).toContain("bootstrapStatus === 'loading'")
expect(app).toContain('App wird geladen')
expect(app).toContain('bootstrapApp')
expect(app).toContain('Erneut versuchen')
expect(home).toContain('<AppLoadingState label="Startseite wird geladen">')
expect(home).toContain('v-else-if="dashboard"')
expect(home).not.toContain('dashboard?.streakDays ?? 0')
```

- [ ] **Step 2: Run RED**

Run: `corepack pnpm exec vitest run tests/renderer/loadingStatesUi.test.ts tests/renderer/homeUi.test.ts`
Expected: FAIL on missing bootstrap and Home loading contracts.

- [ ] **Step 3: Implement Bootstrap and Home state machines**

Render bootstrap before auth gate, place existing startup sequence in `bootstrapApp()` with `try/catch`, and set `ready` only after authentication plus required user context resolves. Add a branded retry panel for `error`. In Home, wrap the existing parallel requests in `loadHome()` with `loading/error/finally`, use three skeleton cards, and preserve real zero values after `dashboard` exists.

- [ ] **Step 4: Run GREEN and commit**

Run: `corepack pnpm exec vitest run tests/renderer/loadingStatesUi.test.ts tests/renderer/homeUi.test.ts tests/renderer/appShellNuxtUi.test.ts tests/renderer/authGateCopy.test.ts`
Expected: PASS.

Commit: `feat: add bootstrap and home loading states`

### Task 3: Prüfungen, Bewertung, Auswertung und Einstellungen

**Files:**
- Modify: `src/renderer/src/views/ExamView.vue`
- Modify: `src/renderer/src/views/CorrectionView.vue`
- Modify: `src/renderer/src/views/AnalyticsView.vue`
- Modify: `src/renderer/src/views/SettingsView.vue`
- Modify: `src/renderer/src/styles/main.css`
- Modify: `tests/renderer/loadingStatesUi.test.ts`

**Interfaces:**
- Each view provides `loading` and `loadError`; retry invokes its existing `load()`.
- `CorrectionView`: `saveBusy`, `commentBusy`.
- `AnalyticsView`: `taskBusyId: string | null`.
- `SettingsView`: `userActionBusy: 'create' | 'rename' | 'switch' | 'tour' | null`.

- [ ] **Step 1: Add failing per-view source contracts**

```ts
for (const file of ['ExamView.vue', 'CorrectionView.vue', 'AnalyticsView.vue', 'SettingsView.vue']) {
  expect(await view(file)).toContain('<AppLoadingState')
  expect(await view(file)).toContain('loadError')
  expect(await view(file)).toContain('Erneut versuchen')
}
expect(correction).toContain(':loading="saveBusy"')
expect(correction).toContain(':loading="commentBusy"')
expect(analytics).toContain(':loading="taskBusyId === task.id"')
expect(settings).toContain('userActionBusy')
```

- [ ] **Step 2: Run RED**

Run: `corepack pnpm exec vitest run tests/renderer/loadingStatesUi.test.ts`
Expected: FAIL for all four unfinished views.

- [ ] **Step 3: Implement minimal first-load, retry and action states**

Use page-shaped skeletons before content/empty branches. Wrap each load in `try/catch/finally`, reset error at retry start, and do not clear prior data during refresh. Guard every mutation busy flag with `try/finally`. Analytics keeps independent learning-task error handling while a failed entries request becomes the page-level error.

- [ ] **Step 4: Run GREEN and commit**

Run: `corepack pnpm exec vitest run tests/renderer/loadingStatesUi.test.ts tests/renderer/generalViewsNuxtUi.test.ts tests/renderer/examSupportNuxtUi.test.ts tests/renderer/examViewIntegrity.test.ts tests/renderer/settingsProfileUi.test.ts`
Expected: PASS.

Commit: `feat: add loading states to exam workflows`

### Task 4: Karteikarten und Podcasts harmonisieren

**Files:**
- Modify: `src/renderer/src/views/DashboardView.vue`
- Modify: `src/renderer/src/views/FlashcardsCollectionsView.vue`
- Modify: `src/renderer/src/views/FlashcardsCollectionDetailView.vue`
- Modify: `src/renderer/src/views/FlashcardsReviewView.vue`
- Modify: `src/renderer/src/views/FlashcardsStatisticsView.vue`
- Modify: `src/renderer/src/views/PodcastsView.vue`
- Modify: `src/renderer/src/views/PodcastSeriesView.vue`
- Modify: `src/renderer/src/styles/main.css`
- Modify: `tests/renderer/loadingStatesUi.test.ts`
- Modify: `tests/renderer/flashcardsNuxtUi.test.ts`
- Modify: `tests/renderer/podcastsUi.test.ts`

**Interfaces:**
- Existing `loading`, `refreshing`, store loading and player loading sources remain authoritative.
- Flashcard collection actions add `createBusy`, `importBusy`, and `exportBusy`.
- All initial skeleton regions use `AppLoadingState`; refresh regions use `aria-busy` and keep content.

- [ ] **Step 1: Add failing harmonization tests**

```ts
expect(collections).toContain('<AppLoadingState label="Sammlungen werden geladen">')
expect(collections).toContain(':loading="createBusy"')
expect(collections).toContain(':loading="importBusy"')
expect(collections).toContain(':loading="exportBusy"')
for (const source of [dashboard, detail, review, statistics, podcasts, series]) {
  expect(source).toContain('<AppLoadingState')
}
```

- [ ] **Step 2: Run RED**

Run: `corepack pnpm exec vitest run tests/renderer/loadingStatesUi.test.ts tests/renderer/flashcardsNuxtUi.test.ts tests/renderer/podcastsUi.test.ts`
Expected: FAIL on text-only/unwrapped loading states and action flags.

- [ ] **Step 3: Implement wrappers and mutation feedback**

Replace only the initial visual loading branches with the shared wrapper, retaining current skeleton shapes. Add structured collection-card skeletons. Preserve loaded data for refreshes, expose `aria-busy`, and use `try/finally` for import/export/create actions. Podcast retry buttons call dedicated `loadCatalog()` methods.

- [ ] **Step 4: Run GREEN and commit**

Run: `corepack pnpm exec vitest run tests/renderer/loadingStatesUi.test.ts tests/renderer/flashcardsNuxtUi.test.ts tests/renderer/flashcardsStatisticsUi.test.ts tests/renderer/podcastsUi.test.ts tests/renderer/podcastPlayer.test.ts`
Expected: PASS.

Commit: `feat: harmonize learning and podcast loading states`

### Task 5: Nutzerstory, Accessibility und Gesamtverifikation

**Files:**
- Modify: `docs/user-stories.md`
- Modify: `tests/renderer/accessibilityContract.test.ts`
- Modify: `tests/e2e/app.e2e.spec.ts` only if existing selectors require stable loading waits.

**Interfaces:**
- Documentation adds one cross-cutting story with initial, refresh, action, empty and error acceptance criteria.

- [ ] **Step 1: Add failing documentation/accessibility contracts**

```ts
expect(userStories).toContain('Verlässliche Ladezustände')
expect(userStories).toContain('noch geladen')
expect(userStories).toContain('echter Leerzustand')
expect(loadingState).toContain('prefers-reduced-motion')
```

- [ ] **Step 2: Run RED**

Run: `corepack pnpm exec vitest run tests/renderer/loadingStatesUi.test.ts tests/renderer/accessibilityContract.test.ts`
Expected: FAIL until documentation and motion contract exist.

- [ ] **Step 3: Update documentation and run focused GREEN**

Document observable behavior, add the reduced-motion style, and adjust only E2E waiting that otherwise races the new explicit loading phase.

- [ ] **Step 4: Run repository checks**

Run:

```bash
corepack pnpm exec vue-tsc --noEmit -p tsconfig.web.json
corepack pnpm exec tsc --noEmit -p tsconfig.node.json
corepack pnpm exec vitest run
corepack pnpm run build
corepack pnpm run test:e2e
git diff --check
```

Expected: all checks pass; if E2E cannot run for an environmental reason, capture the exact command and reason.

- [ ] **Step 5: Commit**

Commit: `docs: document reliable loading feedback`
