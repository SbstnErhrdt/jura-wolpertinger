# Website- und Screenshot-Aktualisierung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $subagent-driven-development (recommended) or $executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the public Hugo website with current real app screenshots and genuinely transparent, optimized Wolpi artwork.

**Architecture:** Generate transparent-background edits of the three existing brand illustrations, capture deterministic screenshots from a disposable local Electron profile, and update the Hugo homepage/CSS while preserving download hooks. Rebuild the checked-in `docs/` output from source.

**Tech Stack:** Hugo, HTML/CSS, Playwright Electron, ImageGen, ImageMagick/WebP tooling, Vitest.

## Global Constraints

- Product screenshots must come from the real app and contain only demo data.
- Wolpi figures must have real alpha transparency and no white rectangle.
- Preserve `download-grid`, `detected-download`, all `data-os` attributes and download JavaScript behavior.
- Keep desktop and mobile layouts readable without overlapping figures.

---

### Task 1: Transparent Wolpi assets

**Files:**
- Replace: `website/static/assets/wolpi/hero.png`
- Replace: `website/static/assets/wolpi/cards.png`
- Replace: `website/static/assets/wolpi/desktop.png`
- Create: `tests/website/assets.test.ts`

**Interfaces:**
- Produces: stable transparent image URLs already consumed by the homepage.
- Consumes: existing three Wolpi images as edit targets.

- [ ] Add a failing asset test that checks all files exist, include non-opaque alpha pixels and remain below the agreed web-size ceiling.
- [ ] Run `pnpm vitest run tests/website/assets.test.ts` and confirm failure because the current images are fully opaque.
- [ ] Use built-in ImageGen background extraction separately for each image, preserving subject, objects, text and pose.
- [ ] Copy final outputs into the existing stable asset paths and optimize metadata/file size without flattening alpha.
- [ ] Inspect all three images visually and rerun the asset test.

### Task 2: Deterministic current screenshots

**Files:**
- Create: `scripts/capture-website-screenshots.mjs`
- Replace: `website/static/screenshots/1_home.png`
- Replace: `website/static/screenshots/2_karteikarten.png`
- Replace: `website/static/screenshots/3_podcasts.png`
- Replace: `website/static/screenshots/4_wiederholen.png`
- Replace: `website/static/screenshots/5_pruefungen.png`
- Replace: `website/static/screenshots/6_statistik.png`
- Modify: `tests/website/assets.test.ts`

**Interfaces:**
- Produces: six 1440x960 light-theme screenshots from a disposable user-data directory.
- Consumes: Electron build, preload API, demo exams and explicitly seeded learning/podcast data.

- [ ] Extend the asset test to require the six exact files, dimensions and a practical byte-size ceiling; run it and confirm the new names fail.
- [ ] Implement the capture script to launch `out/main/index.js`, dismiss onboarding, seed deterministic collections/reviews through the public preload API, navigate to each route, wait for stable UI/fonts/images, and capture without browser chrome.
- [ ] Build the app, run the capture script, inspect all six images, and optimize them losslessly or near-losslessly.
- [ ] Rerun the asset test and confirm it passes.

### Task 3: Homepage content and layout

**Files:**
- Modify: `website/layouts/index.html`
- Modify: `website/assets/css/main.css`
- Create: `tests/website/homepage.test.ts`

**Interfaces:**
- Consumes: new screenshot filenames and transparent Wolpi paths.
- Produces: updated semantic homepage while preserving download adapter hooks.

- [ ] Add a failing homepage contract test for all six image paths, podcast copy, stable download IDs and lazy-loading of non-hero media.
- [ ] Run `pnpm vitest run tests/website/homepage.test.ts tests/website/downloads.test.ts` and confirm the new expectations fail while download tests remain green.
- [ ] Update feature copy, screenshot captions and layout markup; reduce hero tilt/shadow and apply consistent screenshot frames and responsive Wolpi placement.
- [ ] Re-run focused website tests and confirm they pass.

### Task 4: Build and visual verification

**Files:**
- Regenerate: `docs/`
- Update: `docs/user-stories.md`

**Interfaces:**
- Consumes: Hugo source and static assets.
- Produces: checked-in deployable site.

- [ ] Update the public-site user story to cover real current screenshots and transparent artwork.
- [ ] Run the repository's documented Hugo build into `docs/`.
- [ ] Run website tests and `git diff --check`.
- [ ] Serve the built site locally and capture desktop plus mobile pages for visual inspection; check no overlap, white Wolpi rectangles, clipping or broken image references.
- [ ] Commit website source, generated output and assets.
