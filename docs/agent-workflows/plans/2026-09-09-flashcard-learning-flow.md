# Flashcard Learning Flow Implementation Plan

> **For agentic workers:** Use subagent-driven-development for bounded backend work and requesting-code-review for final review. User approved implementation and production web deployment on 2026-09-09; continue without additional approval checkpoints.

**Goal:** Ship the approved persistent collection traversal with deferred cards, honest coverage, three ratings, undo and explicit finite reviews.

**Architecture:** One typed `studyFlashcards(command)` API serves the view in all environments. SQLite and browser storage share a synchronous traversal engine; a Supabase RPC owns the same contract with server-side bounded card retrieval. Review events and schedules remain compatible; undo marks events void rather than deleting them.

**Tech Stack:** Vue 3, TypeScript, Vitest, SQLite, PostgreSQL/Supabase, Playwright.

## Global constraints

- First pass progresses through every previously unreviewed eligible card exactly once, regardless of rating; existing reviews count as completed.
- Snapshot membership/order persists across sessions; new cards are counted separately. Deferred cards persist and are resumed only by explicit action.
- Modes: `first_pass`, `review` (already reviewed and due), `weak` (last rating 1/2), `all` (fresh full traversal).
- Batches contain at most 40 cards, with no 40-card session limit. No unbounded client exclusion arrays or loading all cloud card bodies.
- Ratings 1/2/3 mean Nicht gewusst / Teilweise gewusst / Gewusst; old 4 remains intact.
- Duplicate rating requests with the same event ID do not add events or advance twice. Undo restores schedule and traversal, refuses to overwrite a subsequent review, and voids the event.
- User isolation, archive/quality exclusion, finite completion and resumability are mandatory.
- Existing unrelated podcast changes in both repositories must be preserved. Deploy the web app and required migration, not a new desktop release.
- No secrets in logs or source. SQL apply must use `ON_ERROR_STOP=1`, run in a transaction, and precede frontend publication.

## Task 1: Contract, traversal engine and browser adapter (root)

Files: `src/shared/flashcardStudy.ts`, `src/shared/ipc.ts`, `src/renderer/src/api.ts`, tests under `tests/shared` and `tests/renderer`.

- [x] Define the command/response contract in `src/shared/flashcardStudy.ts` (authoritative contract consumed by all tasks).
- [x] Add failing tests using 100 cards: all rated 1 reaches 100 distinct IDs; reload resumes at 41; defer survives restart; snapshot ignores added cards; idempotent rating and undo.
- [x] Implement shared synchronous engine with storage callbacks for cards/runs/review capture/record/undo.
- [x] Persist browser runs alongside existing browser store; commit review and run state together in one storage write.
- [x] Run focused Vitest tests and inspect result.

```ts
const first = executeStudyCommand({ action: 'start', collectionId, mode: 'first_pass' }, context)
expect(first.run?.total).toBe(100)
expect(first.cards).toHaveLength(40)
```

## Task 2: Supabase traversal RPC (backend implementer)

Files: sibling `jura-supabase/sql/app/009_flashcard_study_runs.sql`, manifest, SQL regression test.

- [x] Read shared command/response contract; implement `public.study_flashcards(p_command jsonb) returns jsonb` with camelCase response keys.
- [x] Write rollback SQL scenarios for 100 distinct cards, deferral, restart, user isolation, additions, repeated command and undo; run failing scenario before migration.
- [x] Create run membership and review-action tables with RLS; serialized mutation and stable order; enforce prompt visibility on every action.
- [x] Reuse `record_review` for scheduling and idempotent event writes. Preserve exact previous schedule for undo, mark review event voided, exclude voided events from existing activity/statistics queries.
- [x] Apply/test against isolated local PostgreSQL, then return migration + test evidence for review. Do not deploy.

```sql
select public.study_flashcards(jsonb_build_object('action','start','collectionId',collection_id,'mode','first_pass'));
```

## Task 3: Desktop storage and IPC (after backend implementer is finished)

Files: `src/main/services/flashcardStudyService.ts`, `database.ts`, `services.ts`, shared constants, preload and main IPC; main regression tests.

- [x] Write failing service tests through `AppServices.studyFlashcards` and persist/reopen the database.
- [x] Store shared-engine run records per local user with schema migration; make actions transactional with normal review writes.
- [x] Add review event tombstones, filter statistics/activity, and carry tombstones across existing learning sync.
- [x] Wire typed `learning:study` IPC and run tests.

```ts
const result = services.studyFlashcards({ action: 'start', collectionId: collection.id, mode: 'first_pass' })
expect(result.run?.remaining).toBe(100)
```

## Task 4: Cloud adapter and Vue flow (root)

Files: `cloudLearningApi.ts`, `views/FlashcardsReviewView.vue`, collection/hub/home/statistics views, help/about, scoped styles, user stories, renderer/e2e tests.

- [x] Map the same typed command to `study_flashcards` and validate the returned structure.
- [x] Replace volatile 40-card session with stored run, bounded refill, explicit deferred phase, pause and genuine completion states.
- [x] Keep question with answer; hide answer-revealing card metadata until reveal. Three rating controls, pending-state protection, undo and keyboard repeat guard.
- [x] Overview loads server summaries, continues named collection, exposes explicit review/weak/all starts and eligible new-card counts.
- [x] Voice shares the same rating path without recording twice; proposed assessment is confirmed/corrected by the learner.
- [x] Update help/about/statistics labels and tests. Check light/dark/mobile and keyboard flow with Playwright.

## Task 5: Review, verify and production deploy (root + independent reviewer)

- [x] Review integrated changes against approved concept and resolve critical/important issues.
- [x] Run typecheck, full unit/service suite, build and e2e checks. Run the new SQL regression suite locally.
- [x] Backup current static app and targeted database schema/data needed for rollback without exposing secrets.
- [x] Apply only the new SQL migration on server. Run rollback-only SQL regression tests there.
- [x] Build with production auth configuration, stage hashed assets, publish index last while retaining old assets for open clients.
- [x] Verify public app asset hashes, authenticated study RPC, browser smoke (login/cards/exams), and existing public routes.
- [x] Record exact checks, deployment result and material limitations.

Completed: see [deployment and verification record](../2026-09-09-flashcard-learning-deployment.md). The final authenticated production run passes both delayed-response regressions, all 47 distinct cards with exact event counts, login/content creation, and the exam editor. No desktop installer was published.
