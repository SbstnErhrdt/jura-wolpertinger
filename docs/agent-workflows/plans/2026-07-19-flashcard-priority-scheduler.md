# Flashcard Priority Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $subagent-driven-development (recommended) or $executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make flashcard review always available while using schedule timestamps only as learning recommendations.

**Architecture:** Keep existing schedule tables and API shapes for compatibility. Change batch selection in Electron, browser fallback, and Supabase RPC so `due_at`/`dueAt` affects ordering and labels, not visibility. Adjust user-facing copy from hard "faellig" language to recommendation language.

**Tech Stack:** Vue/Electron, TypeScript, Vitest, SQLite, Supabase PostgreSQL/RPC.

## Global Constraints

- Do not physically remove `due_at` in this pass.
- `due_at` is treated as the next suggested review time.
- A user can start a review whenever matching cards exist.
- Electron, browser fallback, and cloud must have consistent semantics.
- Avoid technical copy for users.

---

### Task 1: Local Electron Scheduler

**Files:**
- Modify: `tests/main/learningReview.test.ts` or the existing main service test covering `getReviewBatch`.
- Modify: `src/main/services/services.ts`.

**Interfaces:**
- Consumes: `AppServices.getReviewBatch(input?: GetReviewBatchInput): ReviewCard[]`.
- Produces: review batches that include future-scheduled cards after currently suggested cards.

- [ ] **Step 1: Write failing tests**

Add a test that creates two cards, rates one as `Leicht`, and then expects `getReviewBatch({ collectionId })` to still return that reviewed card when no other cards are available. Add a second assertion that a new/currently due card appears before the future-scheduled card.

- [ ] **Step 2: Run the focused test**

Run: `pnpm vitest run tests/main/<selected-test>.test.ts`
Expected: FAIL because future-scheduled cards are filtered out.

- [ ] **Step 3: Implement local query change**

Remove `COALESCE(s.due_at, c.created_at) <= ?` from `getReviewBatch` queries. Order with suggested/due cards first, then newest non-suggested cards:

```sql
ORDER BY
  CASE WHEN COALESCE(s.due_at, c.created_at) <= ? THEN 0 ELSE 1 END ASC,
  COALESCE(s.due_at, c.created_at) ASC,
  c.created_at ASC
```

- [ ] **Step 4: Run the focused test**

Run: `pnpm vitest run tests/main/<selected-test>.test.ts`
Expected: PASS.

### Task 2: Browser Fallback Scheduler

**Files:**
- Modify: `tests/renderer/browserApi.test.ts`.
- Modify: `src/renderer/src/api.ts`.

**Interfaces:**
- Consumes: browser fallback `getReviewBatch`.
- Produces: same non-blocking review behavior as Electron.

- [ ] **Step 1: Write failing test**

Add a browser fallback test that records a review, then verifies the same card can still be returned by `getReviewBatch` when it matches the selected collection.

- [ ] **Step 2: Run focused test**

Run: `pnpm vitest run tests/renderer/browserApi.test.ts`
Expected: FAIL because `.filter((card) => card.dueAt <= now)` removes it.

- [ ] **Step 3: Implement fallback change**

Remove the hard due filter and sort with suggested cards first:

```ts
.sort((left, right) => {
  const leftFuture = left.dueAt > now ? 1 : 0
  const rightFuture = right.dueAt > now ? 1 : 0
  if (leftFuture !== rightFuture) return leftFuture - rightFuture
  return left.dueAt.localeCompare(right.dueAt)
})
```

- [ ] **Step 4: Run focused test**

Run: `pnpm vitest run tests/renderer/browserApi.test.ts`
Expected: PASS.

### Task 3: Cloud Scheduler

**Files:**
- Modify: `jura-supabase/tests/sql/001_learning_foundation_test.sql`.
- Modify: `jura-supabase/sql/app/001_learning_foundation.sql`.
- Modify: `src/renderer/src/cloudLearningApi.ts`.
- Modify: `tests/renderer/cloudLearningApi.test.ts`.

**Interfaces:**
- Consumes: Supabase RPC `get_review_batch`.
- Produces: cloud batches that include future-suggested cards and prioritize currently suggested cards.

- [ ] **Step 1: Write failing SQL test**

After `record_review(... rating 3 ...)`, assert `get_review_batch(...)` still returns the reviewed prompt. Keep a separate assertion for priority/order where possible.

- [ ] **Step 2: Run SQL test**

Run existing Supabase SQL test command if available, otherwise run targeted Docker SQL harness.
Expected: FAIL because RPC filters `s.due_at <= now()`.

- [ ] **Step 3: Implement RPC change**

Remove `and (s.due_at is null or s.due_at <= now())`. Order with missing/due schedules first, future suggestions later.

- [ ] **Step 4: Update cloud client tag fallback**

Remove `.filter((card) => card.dueAt <= now)` from the tag fallback and sort suggested cards first.

- [ ] **Step 5: Run cloud tests**

Run: `pnpm vitest run tests/renderer/cloudLearningApi.test.ts`
Run SQL test harness.
Expected: PASS.

### Task 4: UX Copy

**Files:**
- Modify: `src/renderer/src/views/FlashcardsReviewView.vue`.
- Modify: `src/renderer/src/views/FlashcardsCollectionsView.vue`.
- Modify: `src/renderer/src/views/FlashcardsCollectionDetailView.vue`.
- Modify: relevant renderer tests.

**Interfaces:**
- Produces: user-facing labels using "empfohlen" or neutral wording instead of blocking "faellig".

- [ ] **Step 1: Add/adjust tests**

Update tests that assert copy to expect "empfohlen" where the old copy implied hard availability.

- [ ] **Step 2: Implement copy changes**

Replace blocking empty state "Keine Karten faellig" with "Keine Karten in dieser Auswahl" or "Noch keine Karteikarten". Replace visible metrics from "faellig" to "empfohlen" where they refer to suggested practice.

- [ ] **Step 3: Run renderer tests**

Run focused renderer tests, then typecheck.

### Task 5: Verification And Deployment

**Files:**
- Commit app changes in the main repo.
- Commit Supabase SQL/deploy changes in the Supabase repo.

- [ ] **Step 1: Run full relevant verification**

Run:

```bash
pnpm vitest run tests/main tests/renderer
pnpm typecheck
```

Run Supabase SQL tests or at least the modified test file through the existing harness.

- [ ] **Step 2: Build production web**

Run production web build with server Supabase env.

- [ ] **Step 3: Deploy**

Deploy updated static app and Supabase SQL migration to `server.02`.

- [ ] **Step 4: Verify production**

Check app bundle, Supabase RPC behavior, and a review route in the browser/API.
