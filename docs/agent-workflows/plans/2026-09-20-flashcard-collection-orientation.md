# Flashcard Collection Orientation Implementation Plan

> **For agentic workers:** Use test-driven-development and executing-plans; the independent SQL task may use subagent-driven-development. The user approved implementation without further questions.

**Goal:** Show collection progress, global search and one explainable next-learning recommendation.

**Architecture:** Extend the existing typed `studyFlashcards` command with a read-only `catalog` action. Local adapters use the shared engine; the cloud adapter calls a dedicated bounded SQL RPC. A small shared catalog module owns ranking and progress; the Vue view owns debounced search and request ordering.

**Tech Stack:** Existing Vue, TypeScript, Zod, Vitest, Playwright, SQLite and PostgreSQL. No new dependencies.

## Global Constraints

- Preserve existing dirty changes. Work in the current feature checkout; do not create another worktree or make unrelated commits.
- No production deployment, no credentials, no learning-data writes for catalog reads.
- Priority: due reviews, latest active run, smallest positive new-card count. Tie-break by collection ID.
- Search names and subjects case-insensitively; literal input; trimmed query; 250 ms debounce; pages of 24.
- Recommendation spans all the user's collections, not the current search/page.
- Progress is reviewed/eligible, never mastery; incomplete progress stays below 100%.

## Shared contract

```ts
type StudyCollection = {
  id: string; name: string; subject: string | null; overview: StudyOverview;
  defaultRun: StudyRun | null
}
type StudyRecommendation = { kind: 'review' | 'resume' | 'new'; collection: StudyCollection }
type StudyCatalog = {
  items: StudyCollection[]; total: number; collectionCount: number;
  eligibleCollectionCount: number; recommendation: StudyRecommendation | null
}
// Add to StudyCommand:
// { action: 'catalog'; search?: string; page?: number }
// Add optional catalog: StudyCatalog to StudyResponse.
// Cloud RPC get_study_collection_catalog(p_search text default '', p_page integer default 1)
// returns the normal StudyResponse envelope with catalog populated and other fields empty/null.
// overview.activeRun is the latest active run for the recommendation.
// defaultRun preserves first_pass/all priority for the existing collection-tile action.
```

### Task 1: Read-only cloud catalog

**Files:** `../jura-supabase/sql/app/011_study_collection_catalog.sql`, its MANIFEST entry, `../jura-supabase/tests/sql/011_study_collection_catalog_test.sql`.

**Interface:** Implement the RPC above, camelCase JSON matching the shared contract. Reuse `require_jwt_user_id`, `study_eligible_prompts` and read-only `study_run_summary`; never call the mutating `study_flashcards` from this query. Recommendation counts use all owned/readable nonarchived collections. Select the newest genuinely active run per collection (updated time descending, run ID ascending). Sort visible collections by ID, independent of ranking. Search with literal substring matching, not LIKE wildcard interpretation. Validate positive integer page and bound returned items to 24. Never return card contents. A zero-result page still includes counts and the global recommendation. Security definer uses fixed search_path, explicit ownership/readability and revoked public/anon grants.

- [x] Write rollback SQL tests first: two users, >24 collections, search beyond page one, literal `%`/`_`, due versus active/new, empty/paused/finished states, global recommendation during search, unauthenticated rejection and no run mutation.
- [x] Run the focused test before migration and record expected missing-function failure.
- [x] Implement the RPC using aggregate CTEs and bounded JSON aggregation; register migration.
- [x] Apply only to an isolated local test database; run focused tests and existing study SQL regressions. Report commands, results and any environment limitation. Do not deploy.

### Task 2: Local engine and cloud adapter

**Files:** shared `flashcardStudy.ts`, new `studyCatalog.ts`, `flashcardStudyEngine.ts`; main `flashcardStudyService.ts` and `services.ts`; renderer `api.ts`, `cloudLearningApi.ts`; shared/main/renderer test files.

**Interfaces:** `buildStudyCatalog(collections: StudyCollection[], search = '', page = 1): StudyCatalog`; `studyProgress(overview: StudyOverview): number | null`. `StudyContext` gains optional metadata callback `collections(): {id,name,subject}[]`. Catalog summarizes a cloned run list to prevent the normal summarize logic from persisting completion. Desktop returns before saving runs; browser skips store writes. Existing actions preserve behavior. Cloud dispatches catalog to the dedicated RPC and validates the response with Zod.

- [x] Test engine through `executeStudyCommand({action:'catalog'}, context)` and prove ranking, pagination, trimmed/literal search and unchanged stored runs. Test progress boundaries including 999/1000. Confirm expected failure.
- [x] Implement schema and pure catalog helper, then local engine/adapters. Keep the existing IPC method and transport unchanged because the shared command union already types it end-to-end.
- [x] Add a cloud adapter test asserting only `get_study_collection_catalog` with search/page parameters, no table fetches and rejection of absent/malformed catalog payloads.
- [x] Run focused shared, browser, cloud and main tests plus typecheck.

### Task 3: Collection overview UX

**Files:** `FlashcardsCollectionsView.vue`, new `ui/studyCatalogNavigation.ts`, new `ui/studyCatalogLoader.ts`, view-scoped styles, Help/About views, user stories; renderer unit and collection E2E test files.

**Interfaces:** recommendation navigation returns explicit `review`, exact run ID/mode for `resume`, and `first_pass` for `new`; never use the generic new-before-due entry helper for the recommendation. Request controller increments a sequence immediately when a query is invalidated, applies only latest responses and disposes timers on unmount.

- [x] Write failing pure navigation/request ordering tests and an E2E scenario creating collections, searching, checking progress and clicking the recommended review action.
- [x] Replace the unbounded overview load with the catalog action; display one recommendation, labeled search/reset/count, paginated grid, loading/error/retry and distinct empty states.
- [x] Add accessible progress values at card bottoms, paused counts, disabled empty starts and aligned actions. Keep import/export/create flows and existing individual collection actions.
- [x] Update help/about and user stories. Run typecheck, focused tests, build, full tests and relevant Electron E2E/Axe checks. Inspect desktop/mobile and both themes.

## Progress

- Plan self-reviewed against approved spec. Existing IPC command avoids unnecessary new transport functions.
- All three implementation tasks complete locally. Existing dirty changes preserved; no implementation commit, push or production deployment.
- Independent SQL review passed. App review found one default-action regression: recommendation needs the newest run while collection tiles must keep their previous first-pass/all preference. Added `defaultRun` consistently in schema, engine, SQL and UI with regression tests; re-review confirmed the finding closed and no further findings.

## Verification — 20 September 2026

- `corepack pnpm run typecheck`: passed.
- `corepack pnpm rebuild better-sqlite3 && corepack pnpm exec vitest run`: 69 files, 473 tests passed after the final default-run correction.
- `corepack pnpm exec electron-rebuild -f -w better-sqlite3 && corepack pnpm run build`: passed, including both typecheck configurations and the production renderer build.
- `corepack pnpm exec playwright test`: 9 passed, 1 failed. The new `studyCatalog.e2e.spec.ts` passed (search, pagination, global recommendation, 33% progress, exact resume, explicit due-review start, desktop/mobile and light/dark Axe scans). The existing large study-run flow also passed.
- The separate failure is `app.e2e.spec.ts:59`, library folder navigation, at its dark-theme Axe scan (`:127`): intermittent `color-contrast` for `.active`. Focused reproduction with `--repeat-each=2` produced one failure and one pass without code changes. No library styles or test assertions were changed for this feature; this remains an unrelated full-suite limitation, not a green full-E2E claim.
- Local PostgreSQL: `./scripts/test-sql.sh tests/sql/011_study_collection_catalog_test.sql tests/sql/009_flashcard_study_sync_test.sql tests/sql/009_flashcard_study_completion_test.sql tests/sql/009_flashcard_schedule_deletion_test.sql tests/sql/009_flashcard_learning_progress_test.sql tests/sql/009_flashcard_study_runs_test.sql` passed all six rollback suites after the final SQL update.
- Screenshots visually inspected: `/tmp/jura-study-catalog-light.png` (1440px desktop) and `/tmp/jura-study-catalog-dark.png` (390px mobile). Progress remains legible in both themes; no horizontal overflow.
- Existing build warnings remain for the `::highlight` CSS optimizer and VueUse annotation placement. The system `pnpm` is v9 while project Corepack resolves v10; the bare `pnpm` nested in the normal test script hits a store-version mismatch, so equivalent commands above explicitly use Corepack. No dependencies or package-manager configuration were changed for this feature.

## Handoff

Cloud activation requires deploying the registered `011_study_collection_catalog.sql` migration and the matching renderer together. This task only applied the migration to the local test database; no production account, card contents, ratings or persisted learning progress were changed.

Subsequent explicit publication request fulfilled on 20 September 2026: migration
and isolated web candidate deployed and publicly verified. See
[deployment report](../2026-09-20-flashcard-collection-deployment.md). No real-user
learning data were modified; disposable smoke-test accounts were removed.
