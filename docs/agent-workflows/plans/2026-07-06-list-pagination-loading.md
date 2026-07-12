# List Pagination Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $subagent-driven-development (recommended) or $executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add paginated exam and flashcard management lists with clear loading, empty, and error states across SQLite, browser fallback, and Supabase learning mode.

**Architecture:** Add paginated API contracts beside existing array-returning methods, then migrate the high-volume renderer screens to the new contracts. Keep existing bulk/list methods for compatibility and explicit export workflows.

**Tech Stack:** Vue 3, Pinia, Electron IPC, better-sqlite3, Supabase JS, Vitest.

## Global Constraints

- Default page size is 25.
- Valid page sizes are 10, 25, 50, and 100.
- Review batches are not paginated in this iteration.
- Collection overview pagination is out of scope.
- Initial list loads use skeletons; refreshes keep current items visible with a compact busy state.
- Empty states only render after loading completes.

---

### Task 1: Shared Pagination Contract And SQLite Services

**Files:**
- Modify: `src/shared/ipc.ts`
- Modify: `src/main/services/services.ts`
- Test: `tests/main/services.test.ts`

**Interfaces:**
- Produces: `PaginatedResult<T>`, `ListExamsInput`, `ListLearningCardsInput`, `listExamsPage(input)`, `listLearningCardsPage(input)`.
- Consumes: existing `ExamListItem`, `LearningCard`, `AppServices` row mappers.

- [ ] Write failing service tests for paginated exams and cards.
- [ ] Implement shared types and service methods with clamped pagination.
- [ ] Verify targeted service tests pass.

### Task 2: IPC, Preload, Browser Fallback, And Cloud Learning API

**Files:**
- Modify: `src/shared/ipc.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/api.ts`
- Modify: `src/renderer/src/cloudLearningApi.ts`
- Test: `tests/renderer/cloudLearningApi.test.ts`

**Interfaces:**
- Consumes: Task 1 pagination types.
- Produces: `AppApi.listExamsPage(input)` and `AppApi.listLearningCardsPage(input)` available to renderer code.

- [ ] Write failing API tests for browser fallback and Supabase ranged card queries.
- [ ] Wire IPC/preload/browser fallback to the paginated methods.
- [ ] Implement Supabase card pagination with `.range(from, to)` and page-local schedule/tag lookups.
- [ ] Verify targeted renderer API tests pass.

### Task 3: Shared Pagination And Loading UI

**Files:**
- Create: `src/renderer/src/components/ui/AppPagination.vue`
- Create: `src/renderer/src/components/ui/ListSkeleton.vue`
- Modify: `src/renderer/src/styles/main.css`
- Test: `tests/renderer/paginationUi.test.ts`

**Interfaces:**
- Produces: reusable pagination controls and skeleton CSS/markup.
- Consumes: `PaginatedResult` metadata from parent views.

- [ ] Write failing renderer source tests for pagination controls and skeleton affordances.
- [ ] Implement `AppPagination.vue` and generic skeleton component.
- [ ] Add light/dark CSS for skeletons, disabled refresh state, and pagination layout.
- [ ] Verify targeted renderer UI tests pass.

### Task 4: Dashboard Exam Pagination

**Files:**
- Modify: `src/renderer/src/stores/library.ts`
- Modify: `src/renderer/src/views/DashboardView.vue`
- Test: `tests/renderer/paginationUi.test.ts`

**Interfaces:**
- Consumes: `api.listExamsPage(input)` and `AppPagination`.
- Produces: folder-aware, status-aware paginated exam list in the dashboard.

- [ ] Write failing renderer source tests for Dashboard pagination, list range copy, skeleton loading, and no empty-state during loading.
- [ ] Update the store to track exam page, total, page size, loading, refreshing, and errors.
- [ ] Update Dashboard to request pages on folder/page/page-size changes.
- [ ] Verify targeted renderer UI tests pass.

### Task 5: Flashcard Collection Pagination

**Files:**
- Modify: `src/renderer/src/views/FlashcardsCollectionDetailView.vue`
- Test: `tests/renderer/paginationUi.test.ts`

**Interfaces:**
- Consumes: `api.listLearningCardsPage(input)` and `AppPagination`.
- Produces: search/sort-aware paginated card list in collection detail view.

- [ ] Write failing renderer source tests for flashcard pagination, `collection.cardCount` header copy, skeleton loading, and search reset behavior.
- [ ] Update card loading to use paginated API metadata.
- [ ] Keep current items visible during refresh and show errors with retry.
- [ ] Verify targeted renderer UI tests pass.

### Task 6: Verification

**Files:**
- No new files.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: verified implementation status.

- [ ] Run targeted main and renderer tests.
- [ ] Run `pnpm run typecheck`.
- [ ] Report any pre-existing or remaining failures with exact file references.
