# Lernnavigation, Statistik und Podcasts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $subagent-driven-development (recommended) or $executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine konsistente Navigation, belastbare Lernstatistiken und einen globalen Podcast-Katalog mit lokalem und cloudbasiertem Hörfortschritt bereitstellen.

**Architecture:** Gemeinsame Zod-/IPC-Verträge definieren die UI-Grenze. SQLite und Supabase implementieren dieselben Statistik- und Fortschrittsformen. Podcast-Metadaten und Audio sind global, Fortschritt bleibt nutzerbezogen; der Vue-Player lebt oberhalb des Routers.

**Tech Stack:** Electron 33, Vue 3, Nuxt UI 4, TypeScript, Zod, better-sqlite3, Supabase/PostgreSQL/RLS/Storage, Vitest, Playwright.

## Global Constraints

- Der Prüfungseditor und Prüfungsmodus bleiben optisch und funktional unverändert.
- MP3-Dateien sind öffentlich; Nutzerfortschritt ist privat.
- Desktop lokal, Browser-Fallback und Supabase-Web-App verwenden denselben UI-Vertrag.
- Datenbankänderungen sind vorwärts migrierbar und löschen keine Bestandsdaten.
- Fortschritt wird gedrosselt gespeichert und blockiert Audio nicht.

---

### Task 1: Gemeinsame Lern- und Podcast-Verträge

**Files:**
- Modify: `src/shared/schemas.ts`
- Modify: `src/shared/ipc.ts`
- Test: `tests/shared/schemas.test.ts`

- [ ] Statistik-, Podcast-Katalog- und Fortschrittsschemas zuerst als fehlschlagende Tests beschreiben.
- [ ] Tests ausführen und den erwarteten Schemafehler bestätigen.
- [ ] Zod-Schemas und `AppApi`-Methoden ergänzen.
- [ ] Tests und Typecheck grün ausführen.

### Task 2: SQLite-Migration und lokale Dienste

**Files:**
- Modify: `src/shared/constants.ts`
- Modify: `src/main/services/database.ts`
- Modify: `src/main/services/services.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Test: `tests/main/services.test.ts`

- [ ] Fehlende Migration, Statistikaggregation und Podcast-Fortschritt in Tests abbilden.
- [ ] Tests rot ausführen.
- [ ] Schema-Version erhöhen, `podcast_episode_progress` anlegen und Dienste implementieren.
- [ ] IPC anbinden und Tests grün ausführen.

### Task 3: Browser-Fallback und Supabase-API

**Files:**
- Modify: `src/renderer/src/api.ts`
- Modify: `src/renderer/src/cloudLearningApi.ts`
- Test: `tests/renderer/browserApi.test.ts`
- Test: `tests/renderer/cloudLearningApi.test.ts`

- [ ] Paritätstests für Statistik, Katalog und Fortschritt schreiben.
- [ ] Tests rot ausführen.
- [ ] Browser-Store und Supabase-Client implementieren.
- [ ] Tests grün ausführen.

### Task 4: Supabase-Schema, RLS und Storage

**Files:**
- Create: `../jura-supabase/sql/app/008_podcast_catalog_and_progress.sql`
- Modify: `../jura-supabase/sql/app/MANIFEST.txt`
- Create: `../jura-supabase/tests/sql/008_podcast_catalog_and_progress_test.sql`
- Modify: `../jura-supabase/scripts/test-sql.sh`

- [ ] SQL-Test für öffentlichen Katalog, privaten Fortschritt und Statistik-RPC schreiben.
- [ ] Test rot gegen den lokalen Stack ausführen.
- [ ] Tabellen, Indizes, RLS, Grants, Bucket und RPC implementieren.
- [ ] SQL-Stack und Test grün ausführen.

### Task 5: Podcast-Daten und Upload

**Files:**
- Create: `scripts/podcasts/seed-baybo-podcast.ts`
- Create: `src/shared/podcasts/baybo-april-2026.ts`
- Modify: `package.json`
- Test: `tests/podcasts/bayboPodcastSeed.test.ts`

- [ ] Manifest- und Pfadvalidierung als Test schreiben.
- [ ] Test rot ausführen.
- [ ] Deterministischen Katalog aus `series-plan.json`, `summary.json` und den 18 MP3-Dateien erzeugen.
- [ ] Idempotenten Supabase-Seed und Storage-Upload implementieren.
- [ ] Dry-run und Tests grün ausführen.

### Task 6: Statistik-UI

**Files:**
- Create: `src/renderer/src/views/FlashcardsStatisticsView.vue`
- Modify: `src/renderer/src/router.ts`
- Modify: `src/renderer/src/views/FlashcardsHubView.vue`
- Modify: `src/renderer/src/styles/main.css`
- Create: `tests/renderer/flashcardsStatisticsUi.test.ts`

- [ ] UI-Vertrag für Kennzahlen, Aktivitätsdiagramm und Sammlungsfortschritt schreiben.
- [ ] Test rot ausführen.
- [ ] Responsive Nuxt-UI-Ansicht implementieren.
- [ ] Test und Accessibility-Vertrag grün ausführen.

### Task 7: Podcast-Bibliothek und globaler Player

**Files:**
- Create: `src/renderer/src/views/PodcastsView.vue`
- Create: `src/renderer/src/views/PodcastSeriesView.vue`
- Create: `src/renderer/src/components/PodcastPlayer.vue`
- Create: `src/renderer/src/podcasts/usePodcastPlayer.ts`
- Modify: `src/renderer/src/App.vue`
- Modify: `src/renderer/src/router.ts`
- Modify: `src/renderer/src/styles/main.css`
- Create: `tests/renderer/podcastsUi.test.ts`
- Create: `tests/renderer/podcastPlayer.test.ts`

- [ ] Playerzustand, Abschlussgrenze und Fortschrittsdrosselung testen.
- [ ] Tests rot ausführen.
- [ ] Katalogseiten, persistierenden Audio-Player und mobile Playeransicht implementieren.
- [ ] Komponenten-, Type- und Accessibility-Tests grün ausführen.

### Task 8: Sidebar und mobile Navigation

**Files:**
- Modify: `src/renderer/src/App.vue`
- Modify: `src/renderer/src/styles/main.css`
- Modify: `tests/renderer/appShellNuxtUi.test.ts`
- Modify: `tests/renderer/mobileNavigationUi.test.ts`

- [ ] Testvertrag für gedrehten Beta-Badge, Account-Dropdown und Podcast-Einstieg schreiben.
- [ ] Test rot ausführen.
- [ ] Sidebar-Footer und Navigation mit Nuxt-UI-Menüs umbauen.
- [ ] Desktop- und Mobiltests grün ausführen.

### Task 9: Sync, E2E und visuelle Verifikation

**Files:**
- Modify: `src/main/services/learningSyncService.ts`
- Modify: `src/main/services/supabaseSyncClient.ts`
- Modify: `tests/main/learningSyncService.test.ts`
- Modify: `tests/e2e/app.e2e.spec.ts`

- [ ] Merge-Regeln für Podcast-Fortschritt rot testen.
- [ ] Sync implementieren und fokussierte Tests grün ausführen.
- [ ] Vollständige Vitest-, Typecheck-, Build- und Electron-E2E-Matrix ausführen.
- [ ] Desktop- und Mobil-Screenshots auf Überlauf, Player-Abdeckung und Navigation prüfen.
