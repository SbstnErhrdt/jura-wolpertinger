# Lernstandsfarben und Statistiklinks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $subagent-driven-development (recommended) or $executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one accessible three-state learning-status visualization to collection cards and statistics, and link statistics rows to collection details.

**Architecture:** Extend the existing `StudyOverview` contract with grouped last-rating counts, calculate them in the shared study engine and cloud RPC, then render one reusable Vue component in both views. Keep the existing coverage metric and derive the unreviewed remainder from eligible cards.

**Tech Stack:** TypeScript, Vue 3, Zod, Vitest, Playwright, PostgreSQL/Supabase RPC.

## Global Constraints

- `1` is `Nicht gewusst`, `2` is `Teilweise gewusst`, and `3` plus `4` are `Gewusst`.
- Excluded cards do not contribute to status segments or their denominator.
- Colors must have light/dark variants and textual equivalents.
- Statistics collection titles link to route `flashcards-collection`.

---

### Task 1: Shared learning-status contract

**Files:**
- Modify: `tests/shared/studyCatalog.test.ts`
- Modify: `src/shared/flashcardStudy.ts`
- Modify: `src/shared/flashcardStudyEngine.ts`
- Create: `src/shared/learningStatus.ts`
- Create: `tests/shared/learningStatus.test.ts`

**Interfaces:**
- Produces: `LearningStatusCounts`, `learningStatusCounts(cards)`, and `StudyOverview.statusCounts`.
- Consumes: `ReviewCard.lastRating`, `StudyOverview.eligibleCards`.

- [ ] Write failing tests proving that ratings 1, 2, 3/4 and unreviewed cards are grouped correctly and excluded cards never enter the overview counts.
- [ ] Run `pnpm vitest run tests/shared/learningStatus.test.ts tests/shared/studyCatalog.test.ts` and confirm failures mention missing status counts/helper.
- [ ] Implement the minimal shared helper, type and Zod contract, and use it in `executeStudyCommand` after eligibility filtering.
- [ ] Re-run the same tests and confirm they pass.
- [ ] Commit the shared contract and tests.

### Task 2: Cloud study overview parity

**Files:**
- Create: `../jura-supabase/sql/app/012_learning_status_counts.sql`
- Create: `../jura-supabase/tests/sql/012_learning_status_counts_test.sql`
- Modify: `../jura-supabase/sql/app/MANIFEST.txt`
- Modify: `tests/renderer/cloudLearningApi.test.ts`

**Interfaces:**
- Produces: camelCase `statusCounts` in every `study_flashcards` overview.
- Consumes: latest effective `review_events` for eligible prompts.

- [ ] Add a failing SQL contract test with ratings 1, 2, 3, 4, unreviewed and quality-excluded prompts.
- [ ] Run the focused Supabase SQL test command documented in `../jura-supabase/scripts/test-sql.sh` and confirm the missing JSON keys fail.
- [ ] Add migration `012` that replaces only the overview-building portion of `study_flashcards`, preserving security-definer settings, grants and existing command behavior.
- [ ] Extend the renderer RPC fixture to require and parse the new status counts.
- [ ] Re-run focused SQL and renderer cloud tests and confirm both pass.

### Task 3: Shared accessible status bar

**Files:**
- Create: `src/renderer/src/components/LearningStatusBar.vue`
- Modify: `src/renderer/src/styles/main.css`
- Modify: `tests/renderer/flashcardsStatisticsUi.test.ts`
- Modify: `tests/renderer/studyCatalogUi.test.ts`

**Interfaces:**
- Produces: component props `{ total: number; counts: LearningStatusCounts; label: string; showLegend?: boolean }`.
- Consumes: shared status counts and semantic CSS variables.

- [ ] Add failing renderer contract assertions for the component, three segment classes, neutral remainder, legend labels and ARIA value text.
- [ ] Run the two focused renderer tests and confirm failure.
- [ ] Implement the component and shared light/dark CSS variables with red, orange, green and neutral colors.
- [ ] Re-run the focused renderer tests and confirm they pass.

### Task 4: Collection and statistics integration

**Files:**
- Modify: `src/renderer/src/views/FlashcardsCollectionsView.vue`
- Modify: `src/renderer/src/views/FlashcardsStatisticsView.vue`
- Modify: `tests/e2e/studyCatalog.e2e.spec.ts`
- Modify: `docs/user-stories.md`

**Interfaces:**
- Consumes: `LearningStatusBar`, `StudyOverview.statusCounts`, route `flashcards-collection`.
- Produces: consistent collection/status UI and direct collection navigation.

- [ ] Extend E2E expectations so the seeded ratings produce colored segments and the statistics collection title opens the correct collection.
- [ ] Run the focused E2E spec and confirm the new expectations fail.
- [ ] Replace single-color collection progress bars with the shared component, add the compact legend, color the overall rating rows, map study overviews into statistics rows, and render title links with a chevron.
- [ ] Update the card/statistics user story with exact semantic states and navigation.
- [ ] Run typecheck, focused unit tests and the focused E2E spec; confirm they pass.
- [ ] Commit the UI integration.
