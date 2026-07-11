# Nuxt UI Big-Bang Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $subagent-driven-development (recommended) or $executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the complete general application UI to `@nuxt/ui` v4 in one coordinated migration while preserving the entire exam view exactly and keeping local SQLite, cloud Supabase, and existing CI behavior intact.

**Architecture:** Keep the Vue 3/Electron Vite application and its existing `AppApi` runtime adapters. Add Nuxt UI through its Vue/Vite integration, migrate all standard controls outside `ExamView.vue` and `ExamEditor.vue`, centralize brand theming, then remove the superseded custom UI wrappers and generic component CSS. The protected exam view remains on its existing DOM and CSS boundary and receives regression coverage against Nuxt UI/Tailwind side effects.

**Tech Stack:** Vue 3, Electron Vite, TypeScript, `@nuxt/ui` v4, Tailwind CSS, Pinia, Vue Router, SQLite/better-sqlite3, Supabase, Vitest, Playwright.

## Global Constraints

- The complete exam view remains unchanged, including `ExamView.vue`, `ExamEditor.vue`, normal and focus modes, toolbar, timer, task display, status indicators, submission flow, dialogs, and required styles.
- Local Desktop continues to use Electron IPC, SQLite, and the local filesystem.
- Cloud continues to use Supabase Auth, Postgres/RPCs, and Storage through the existing `AppApi` abstraction.
- Existing CI workflow files and command names remain unchanged.
- No feature flag, legacy UI mode, or staged rollout is added.
- No general view outside the protected exam view may retain a custom duplicate of a Nuxt UI standard control when the migration is complete.

---

### Task 1: Protect The Exam Reference Surface And Install Nuxt UI

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `electron.vite.config.ts`
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/src/main.ts`
- Modify: `src/renderer/src/App.vue`
- Modify: `src/renderer/src/styles/main.css`
- Create: `tests/renderer/nuxtUiFoundation.test.ts`
- Create: `tests/renderer/examViewIntegrity.test.ts`

**Interfaces:**
- Consumes: existing `createApp(App).use(createPinia()).use(router)` bootstrap and `data-theme` theme state.
- Produces: global Nuxt UI component registration, Tailwind/Nuxt UI CSS availability, `UApp` root, and an explicit protected exam regression contract.

- [ ] **Step 1: Write failing foundation and protection tests**

Add source-level tests that assert the Vite UI plugin, Vue plugin, `UApp`, `#app.isolate`, CSS imports, and the absence of Nuxt UI component tags in `ExamView.vue` and `ExamEditor.vue`. Assert the editor root classes and toolbar order markers remain present.

```ts
expect(viteConfig).toContain("from '@nuxt/ui/vite'")
expect(main).toContain("from '@nuxt/ui/vue-plugin'")
expect(app).toContain('<UApp>')
expect(index).toContain('<div id="app" class="isolate"></div>')
expect(examView).not.toMatch(/<U[A-Z]/)
expect(examEditor).not.toMatch(/<U[A-Z]/)
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `pnpm vitest run tests/renderer/nuxtUiFoundation.test.ts tests/renderer/examViewIntegrity.test.ts`

Expected: foundation assertions fail because Nuxt UI is not configured; exam integrity assertions pass.

- [ ] **Step 3: Install and configure the Vue/Vite integration**

Run: `pnpm add @nuxt/ui tailwindcss`

Configure the renderer plugin after Vue and before local asset syncing:

```ts
import ui from '@nuxt/ui/vite'

plugins: [vue(), ui({
  ui: {
    colors: { primary: 'wolpi', secondary: 'sky', neutral: 'slate' }
  }
}), syncRendererAssetsPlugin()]
```

Register the Vue plugin and wrap both auth and application branches in `UApp`:

```ts
import ui from '@nuxt/ui/vue-plugin'

createApp(App).use(createPinia()).use(router).use(ui).mount('#app')
```

```vue
<template>
  <UApp>
    <!-- existing auth gate and app shell branches -->
  </UApp>
</template>
```

Add the isolated root and stylesheet imports:

```html
<div id="app" class="isolate"></div>
```

```css
@import "tailwindcss";
@import "@nuxt/ui";
```

Define the full `wolpi` color scale through `@theme static`, and add scoped resets for `.exam-view` and `.focus-view` only where Tailwind preflight changes a measured reference value.

- [ ] **Step 4: Run foundation checks and the existing editor E2E assertions**

Run: `pnpm vitest run tests/renderer/nuxtUiFoundation.test.ts tests/renderer/examViewIntegrity.test.ts`

Expected: PASS.

Run: `pnpm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the foundation**

```bash
git add package.json pnpm-lock.yaml electron.vite.config.ts src/renderer/index.html src/renderer/src/main.ts src/renderer/src/App.vue src/renderer/src/styles/main.css tests/renderer/nuxtUiFoundation.test.ts tests/renderer/examViewIntegrity.test.ts
git commit -m "feat: add nuxt ui renderer foundation"
```

### Task 2: Migrate App Shell, Authentication, Navigation, And Global Dialogs

**Files:**
- Modify: `src/renderer/src/App.vue`
- Modify: `src/renderer/src/styles/main.css`
- Modify: `tests/renderer/mobileNavigationUi.test.ts`
- Create: `tests/renderer/appShellNuxtUi.test.ts`

**Interfaces:**
- Consumes: existing router names, cloud auth state machine, theme composable, onboarding targets, and local user methods.
- Produces: Nuxt UI auth form controls, navigation menus, buttons, selects, modals, and mobile navigation without changing route or event behavior.

- [ ] **Step 1: Write failing shell migration tests**

Assert `App.vue` uses `UButton`, `UInput`, `USelect`, `UModal`, and `UNavigationMenu`, while preserving all router targets and the four mobile labels. Exclude the protected exam route branch from standard-control checks.

- [ ] **Step 2: Run the shell tests and verify RED**

Run: `pnpm vitest run tests/renderer/appShellNuxtUi.test.ts tests/renderer/mobileNavigationUi.test.ts`

Expected: migration assertions fail on native controls.

- [ ] **Step 3: Convert shell controls and overlays**

Represent navigation as typed item arrays, use Nuxt UI components in the auth gate, sidebar footer, onboarding modal, and local-user modal, and preserve existing classes needed by Driver.js and E2E selectors. Keep current function names and handlers.

- [ ] **Step 4: Verify shell behavior**

Run: `pnpm vitest run tests/renderer/appShellNuxtUi.test.ts tests/renderer/mobileNavigationUi.test.ts`

Expected: PASS.

Run: `pnpm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the shell migration**

```bash
git add src/renderer/src/App.vue src/renderer/src/styles/main.css tests/renderer/appShellNuxtUi.test.ts tests/renderer/mobileNavigationUi.test.ts
git commit -m "feat: migrate app shell to nuxt ui"
```

### Task 3: Replace Shared UI Wrappers And Tag Input Controls

**Files:**
- Modify: `src/renderer/src/components/TagInput.vue`
- Create: `src/renderer/src/ui/breadcrumbs.ts`
- Create: `src/renderer/src/ui/actionMenu.ts`
- Create: `tests/renderer/sharedNuxtUi.test.ts`

**Interfaces:**
- Consumes: existing breadcrumb labels/route locations and action-menu callbacks/icons.
- Produces: plain typed item adapters accepted directly by `UBreadcrumb` and `UDropdownMenu`; `TagInput` keeps its current props, emits, keyboard behavior, and CSS hooks. Existing wrapper files remain temporarily until every consumer is migrated in Tasks 4-6.

- [ ] **Step 1: Write failing shared migration tests**

Assert `TagInput.vue` uses `UInput` and `UButton`, and adapter modules export typed item shapes that no longer require wrapper components.

- [ ] **Step 2: Run the tests and verify RED**

Run: `pnpm vitest run tests/renderer/sharedNuxtUi.test.ts`

Expected: FAIL because TagInput uses native controls and the item adapters do not exist.

- [ ] **Step 3: Add adapters and convert TagInput**

Keep breadcrumb data independent of component internals:

```ts
export interface AppBreadcrumbItem {
  label: string
  to?: RouteLocationRaw
  icon?: string
}
```

Keep action handlers on the menu items through `onSelect`. Preserve `.tag-input-field`, `.tag-input-chip`, and suggestion classes for behavior tests. Wrapper deletion is deferred until the completeness pass after every consumer has moved to direct Nuxt UI components.

- [ ] **Step 4: Verify shared components**

Run: `pnpm vitest run tests/renderer/sharedNuxtUi.test.ts tests/renderer/paginationUi.test.ts`

Expected: PASS after pagination tests are updated to assert `UPagination` usage rather than wrapper CSS.

- [ ] **Step 5: Commit shared primitives**

```bash
git add src/renderer/src/components src/renderer/src/ui tests/renderer/sharedNuxtUi.test.ts tests/renderer/paginationUi.test.ts
git commit -m "refactor: replace custom ui wrappers with nuxt ui"
```

### Task 4: Migrate Home, Hub, Information, And Settings Views

**Files:**
- Modify: `src/renderer/src/views/HomeView.vue`
- Modify: `src/renderer/src/views/FlashcardsHubView.vue`
- Modify: `src/renderer/src/views/ExamsHubView.vue`
- Modify: `src/renderer/src/views/MoreHubView.vue`
- Modify: `src/renderer/src/views/SettingsView.vue`
- Modify: `src/renderer/src/views/AboutView.vue`
- Modify: `src/renderer/src/views/HelpView.vue`
- Modify: `src/renderer/src/styles/main.css`
- Create: `tests/renderer/generalViewsNuxtUi.test.ts`

**Interfaces:**
- Consumes: existing API methods, settings state, sync state, route destinations, onboarding event, and page copy.
- Produces: Nuxt UI cards, buttons, fields, alerts, badges, breadcrumbs, switches, selects, and modals while preserving all actions.

- [ ] **Step 1: Write failing general-view migration tests**

Scan the listed files for native standard controls and old wrapper imports. Assert key Nuxt UI components and all existing route names/copy remain present.

- [ ] **Step 2: Run the tests and verify RED**

Run: `pnpm vitest run tests/renderer/generalViewsNuxtUi.test.ts tests/renderer/homeUi.test.ts tests/renderer/mobileNavigationUi.test.ts`

Expected: FAIL on native controls and old breadcrumbs.

- [ ] **Step 3: Convert the seven views**

Use `UBreadcrumb`, `UButton`, `UCard`, `UAlert`, `UFormField`, `UInput`, `USelect`, `USwitch`, and `UModal` as appropriate. Preserve public CSS hooks used by Driver.js and E2E. Do not change settings, sync, theme, or onboarding logic.

- [ ] **Step 4: Verify the general views**

Run: `pnpm vitest run tests/renderer/generalViewsNuxtUi.test.ts tests/renderer/homeUi.test.ts tests/renderer/mobileNavigationUi.test.ts tests/renderer/pageLayoutUi.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit general views**

```bash
git add src/renderer/src/views/HomeView.vue src/renderer/src/views/FlashcardsHubView.vue src/renderer/src/views/ExamsHubView.vue src/renderer/src/views/MoreHubView.vue src/renderer/src/views/SettingsView.vue src/renderer/src/views/AboutView.vue src/renderer/src/views/HelpView.vue src/renderer/src/styles/main.css tests/renderer/generalViewsNuxtUi.test.ts tests/renderer/homeUi.test.ts tests/renderer/mobileNavigationUi.test.ts tests/renderer/pageLayoutUi.test.ts
git commit -m "feat: migrate general views to nuxt ui"
```

### Task 5: Migrate Flashcard Workflows

**Files:**
- Modify: `src/renderer/src/views/FlashcardsCollectionsView.vue`
- Modify: `src/renderer/src/views/FlashcardsCollectionDetailView.vue`
- Modify: `src/renderer/src/views/FlashcardsReviewView.vue`
- Modify: `src/renderer/src/styles/main.css`
- Modify: `tests/renderer/flashcardsUi.test.ts`
- Modify: `tests/renderer/paginationUi.test.ts`
- Create: `tests/renderer/flashcardsNuxtUi.test.ts`

**Interfaces:**
- Consumes: current collection/card APIs, pagination contract, review keyboard handlers, skip mechanism, and card motion state.
- Produces: Nuxt UI collection/card controls, forms, modals, menus, badges, pagination, skeletons, and alerts with unchanged learning behavior and animations.

- [ ] **Step 1: Write failing flashcard migration tests**

Assert all three views use Nuxt UI controls, no old wrappers or native standard controls remain, keyboard hint text remains, and existing card transition class names remain.

- [ ] **Step 2: Run the tests and verify RED**

Run: `pnpm vitest run tests/renderer/flashcardsNuxtUi.test.ts tests/renderer/flashcardsUi.test.ts tests/renderer/paginationUi.test.ts`

Expected: FAIL on old controls while existing behavior tests remain green.

- [ ] **Step 3: Convert collection, detail, and review UI**

Use `UInput`, `USelect`, `UButton`, `UBadge`, `UDropdownMenu`, `UPagination`, `USkeleton`, `UAlert`, `UEmpty`, and `UModal`. Preserve review key listeners, button key labels, skip behavior, previous/next behavior, and all card animation classes and durations.

- [ ] **Step 4: Verify flashcard behavior**

Run: `pnpm vitest run tests/renderer/flashcardsNuxtUi.test.ts tests/renderer/flashcardsUi.test.ts tests/renderer/paginationUi.test.ts tests/renderer/cloudLearningApi.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit flashcard workflows**

```bash
git add src/renderer/src/views/FlashcardsCollectionsView.vue src/renderer/src/views/FlashcardsCollectionDetailView.vue src/renderer/src/views/FlashcardsReviewView.vue src/renderer/src/styles/main.css tests/renderer/flashcardsNuxtUi.test.ts tests/renderer/flashcardsUi.test.ts tests/renderer/paginationUi.test.ts
git commit -m "feat: migrate flashcard workflows to nuxt ui"
```

### Task 6: Migrate Exam Library, Correction, And Analytics Around The Protected Exam View

**Files:**
- Modify: `src/renderer/src/views/DashboardView.vue`
- Modify: `src/renderer/src/views/CorrectionView.vue`
- Modify: `src/renderer/src/views/AnalyticsView.vue`
- Modify: `src/renderer/src/styles/main.css`
- Create: `tests/renderer/examSupportNuxtUi.test.ts`
- Modify: `tests/renderer/paginationUi.test.ts`
- Modify: `tests/renderer/mobileNavigationUi.test.ts`

**Interfaces:**
- Consumes: current library store, drag/drop and context actions, correction workflow, AI settings behavior, analytics filters, pagination, and route names.
- Produces: Nuxt UI controls and overlays for all exam-supporting views without importing or modifying `ExamView.vue` or `ExamEditor.vue`.

- [ ] **Step 1: Write failing support-view migration tests**

Assert the three support views use Nuxt UI standard components, retain all workflow handlers and route links, and contain no old wrapper imports or native standard controls.

- [ ] **Step 2: Run the tests and verify RED**

Run: `pnpm vitest run tests/renderer/examSupportNuxtUi.test.ts tests/renderer/mobileNavigationUi.test.ts tests/renderer/paginationUi.test.ts`

Expected: FAIL on existing controls.

- [ ] **Step 3: Convert support views**

Use Nuxt UI buttons, menus, modals, forms, inputs, selects, textareas, alerts, badges, breadcrumbs, pagination, skeletons, and empty states. Preserve drag/drop classes and events, AI setting and draft state, correction text-selection behavior, and analytics persistence.

- [ ] **Step 4: Verify support workflows**

Run: `pnpm vitest run tests/renderer/examSupportNuxtUi.test.ts tests/renderer/mobileNavigationUi.test.ts tests/renderer/paginationUi.test.ts tests/renderer/aiConnectionFeedback.test.ts`

Expected: PASS.

Run: `pnpm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit support views**

```bash
git add src/renderer/src/views/DashboardView.vue src/renderer/src/views/CorrectionView.vue src/renderer/src/views/AnalyticsView.vue src/renderer/src/styles/main.css tests/renderer/examSupportNuxtUi.test.ts tests/renderer/mobileNavigationUi.test.ts tests/renderer/paginationUi.test.ts
git commit -m "feat: migrate exam support views to nuxt ui"
```

### Task 7: Remove Legacy General UI CSS And Prove Migration Completeness

**Files:**
- Modify: `src/renderer/src/styles/main.css`
- Delete: `src/renderer/src/components/ui/ActionMenu.vue`
- Delete: `src/renderer/src/components/ui/AppBadge.vue`
- Delete: `src/renderer/src/components/ui/AppBreadcrumb.vue`
- Delete: `src/renderer/src/components/ui/AppPagination.vue`
- Delete: `src/renderer/src/components/ui/ListSkeleton.vue`
- Modify: `tests/renderer/pageLayoutUi.test.ts`
- Create: `tests/renderer/nuxtUiCompleteness.test.ts`

**Interfaces:**
- Consumes: all migrated views and the protected exam class allowlist.
- Produces: one Nuxt UI-based general design system, a reduced application stylesheet, and an automated guard against reintroducing native/custom standard controls outside the exam view.

- [ ] **Step 1: Write the completeness test**

Enumerate all renderer Vue files except `ExamView.vue` and `ExamEditor.vue`. Reject native `<button>`, `<input>`, `<select>`, and `<textarea>` tags, deleted wrapper imports, and known generic legacy selectors such as `.dialog-card`, `.app-breadcrumb`, `.pagination-button`, and `.list-skeleton` when they are no longer referenced.

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm vitest run tests/renderer/nuxtUiCompleteness.test.ts`

Expected: FAIL with any remaining migration gaps.

- [ ] **Step 3: Remove remaining legacy controls and dead CSS**

Use `rg` to prove selector references before deletion. Keep domain layout, flashcard motion, print/export rules, and the full exam-view styling boundary. Consolidate shared page width, typography, spacing, and responsive behavior around Nuxt UI semantic tokens.

- [ ] **Step 4: Verify completeness and styling contracts**

Run: `pnpm vitest run tests/renderer/nuxtUiCompleteness.test.ts tests/renderer/pageLayoutUi.test.ts tests/renderer/examViewIntegrity.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit CSS cleanup**

```bash
git add src/renderer/src/styles/main.css tests/renderer/nuxtUiCompleteness.test.ts tests/renderer/pageLayoutUi.test.ts tests/renderer/examViewIntegrity.test.ts
git commit -m "refactor: remove legacy general ui styles"
```

### Task 8: Full Local, Cloud, CI, And Visual Verification

**Files:**
- Modify only when a verification failure demonstrates a migration defect.

**Interfaces:**
- Consumes: complete migrated renderer and unchanged runtime adapters.
- Produces: evidence that the same CI commands, local Electron path, cloud web build, responsive layouts, themes, and protected exam view work after the Big Bang.

- [ ] **Step 1: Run static and unit verification**

Run in order:

```bash
pnpm run typecheck
pnpm test
pnpm run build
```

Expected: all commands exit `0`.

- [ ] **Step 2: Run Electron end-to-end tests**

Run: `pnpm run test:e2e`

Expected: all Playwright Electron flows pass, including editor toolbar order, frame dimensions, dark editor surface, submission, correction, analytics, PDF output, and no unexpected console errors.

- [ ] **Step 3: Verify the production cloud build**

Run `pnpm run build:web:production` with the configured production-web environment variables already used by deployment.

Expected: environment validation, renderer build, Supabase client inspection, and CSS bundle inspection all pass.

- [ ] **Step 4: Perform responsive visual smoke checks**

Start the renderer in development mode and inspect every non-parametric route at desktop and mobile widths in light and dark mode. Check horizontal overflow, clipped labels, duplicate breadcrumbs, loading/empty/error states, modal focus, and navigation reachability. Compare the protected normal and focus exam views against the pre-migration E2E dimensions and screenshots.

- [ ] **Step 5: Review the final diff and commit verification fixes**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Expected: no whitespace errors, no accidental generated build artifacts, no changes to CI workflow behavior, and no unaccounted modifications to the protected exam files.

If verification required fixes, inspect `git diff --name-only`, stage only the exact files changed for those fixes, and commit them with `git commit -m "fix: complete nuxt ui migration verification"`.
