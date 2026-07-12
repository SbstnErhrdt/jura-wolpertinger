# Cloud MVP Flashcards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $subagent-driven-development (recommended) or $executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first deployable cloud/local shared app surface with login-gated web, new home/navigation, and a local-first flashcard MVP.

**Architecture:** Extend the existing Vue/Electron app instead of starting a new frontend. Add shared learning types to the app API, implement local SQLite services for Desktop and browser-dev tests, then gate the production web build behind Supabase Auth. Keep cloud AI correction visible but disabled.

**Tech Stack:** Vue 3, Electron, TypeScript, SQLite/better-sqlite3, Supabase Auth for web, Vitest, Playwright smoke checks, nginx deployment.

## Global Constraints

- Desktop/local and Web/remote must share the same product UI and route structure.
- `app.jura-wolpi.de` must show no functional app without a valid login.
- Desktop must continue to work standalone without an account.
- Cloud KI-Korrektur is visible but disabled.
- Karteikarten MVP includes Collections, tags, Markdown question/answer cards, review, self-rating, history, scheduler, and seed import.
- No Lernzeit/Kalender/iCloud UI in this slice.

---

### Task 1: Learning Domain API

**Files:**
- Modify: `src/shared/schemas.ts`
- Modify: `src/shared/ipc.ts`
- Modify: `src/shared/constants.ts`
- Test: `tests/shared/schemas.test.ts`

**Interfaces:**
- Produces: `LearningCollection`, `LearningCard`, `ReviewCard`, `ReviewRating`, `LearningReviewEvent`, and API methods on `AppApi`.
- Consumes: existing UUID/date validation helpers and `AppUser`.

- [ ] **Step 1: Add shared learning schemas and constants**

Add zod schemas for collections, cards, reviews, ratings, and dashboard summary. Bump `DATABASE_SCHEMA_VERSION` to `4`.

- [ ] **Step 2: Add API method types**

Add methods for listing collections/cards, creating cards, seeding decks, getting review batches, recording ratings, and reading the learning dashboard.

- [ ] **Step 3: Add schema tests**

Verify valid ratings `1-4`, invalid ratings, and basic card parsing.

### Task 2: Local Learning Storage

**Files:**
- Modify: `src/main/services/database.ts`
- Modify: `src/main/services/services.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Test: `tests/main/services.test.ts`

**Interfaces:**
- Consumes: shared learning types.
- Produces: SQLite-backed `AppServices` learning methods and IPC/preload bindings.

- [ ] **Step 1: Add schema v4 tables**

Add local tables for learning collections, cards, tags, card tags, review events, and schedules. Migrate v3 to v4.

- [ ] **Step 2: Implement seed import**

Read deck JSON files from `/Users/sbstn/Documents/sabine/Karteikarten/decks` when available and insert private local collections idempotently.

- [ ] **Step 3: Implement scheduler**

Return due cards ordered by due date, record ratings, reschedule `Nochmal` inside the session window and other ratings with increasing intervals.

- [ ] **Step 4: Wire IPC and preload**

Expose learning methods through Electron IPC and `window.juraApi`.

- [ ] **Step 5: Add service tests**

Verify migration/table creation, seed import, review batch, rating persistence, and next due calculation.

### Task 3: Browser/Web Adapters and Auth Gate

**Files:**
- Modify: `package.json`
- Modify: `src/renderer/src/api.ts`
- Create: `src/renderer/src/cloudAuth.ts`
- Modify: `src/renderer/src/App.vue`
- Test: `tests/renderer/browserApi.test.ts`

**Interfaces:**
- Consumes: `AppApi`.
- Produces: browser-dev learning fallback and production web auth gate.

- [ ] **Step 1: Add web environment detection**

Distinguish Electron, local browser dev, and production web host.

- [ ] **Step 2: Add Supabase Auth gate**

On production web without Electron, require login before rendering the app shell. Do not load browser localStorage app data behind `app.jura-wolpi.de`.

- [ ] **Step 3: Disable cloud AI**

Return clear disabled status and throw a clear cloud-disabled error for generation in web mode.

- [ ] **Step 4: Extend browser-dev fallback**

Add learning API methods for local development tests only.

### Task 4: UI Shell, Home, Navigation, Flashcards

**Files:**
- Modify: `src/renderer/src/router.ts`
- Modify: `src/renderer/src/App.vue`
- Create: `src/renderer/src/views/HomeView.vue`
- Create: `src/renderer/src/views/FlashcardsReviewView.vue`
- Create: `src/renderer/src/views/FlashcardsCollectionsView.vue`
- Modify: `src/renderer/src/views/CorrectionView.vue`
- Modify: `src/renderer/src/styles/main.css`

**Interfaces:**
- Consumes: learning API methods.
- Produces: mobile-friendly Home and flashcard review/collection UI.

- [ ] **Step 1: Add routes**

Create `home`, `flashcards-review`, and `flashcards-collections` routes. Move old dashboard to `/exams`.

- [ ] **Step 2: Rebuild sidebar**

Group navigation into Home, Karteikarten, Pruefungen, Einstellungen/Hilfe/Account.

- [ ] **Step 3: Build Home**

Show image, Streak, due cards, and primary actions.

- [ ] **Step 4: Build Review UI**

Show front/back, rating buttons, interval feedback, and small actions.

- [ ] **Step 5: Build Collections UI**

Show collections, tags, due counts, and seed import action.

- [ ] **Step 6: Cloud AI disabled state**

Show a disabled cloud message instead of triggering AI in production web.

### Task 5: Verify, Build, Deploy

**Files:**
- Modify: deployment app bundle under `jura-supabase/deploy/production/app`

**Interfaces:**
- Consumes: local build output.
- Produces: deployed browser app under `https://app.jura-wolpi.de/`.

- [ ] **Step 1: Run checks**

Run `pnpm run typecheck`, targeted Vitest, and `pnpm run build`.

- [ ] **Step 2: Smoke test locally**

Serve the renderer build and verify protected web route behavior and app rendering.

- [ ] **Step 3: Deploy**

Copy renderer build to production deployment app directory, sync to `server.02`, restart nginx, and verify URLs.

- [ ] **Step 4: Commit and push**

Commit the app changes and deployment bundle changes in their respective repos, push branches, and report exact verification.
