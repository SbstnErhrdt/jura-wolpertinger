# Modern Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $subagent-driven-development (recommended) or $executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize the static Hugo website so it visually matches the app and uses Wolpi imagery without changing release-feed behavior.

**Architecture:** Keep the existing Hugo static site. Update the homepage and shared CSS, copy selected Wolpi assets to static website assets, rebuild `docs/`, and deploy the static output to the production Nginx site folder.

**Tech Stack:** Hugo, static HTML/CSS, existing JavaScript download feed, Vitest website tests.

## Global Constraints

- Primary blue: `#005a84`.
- Do not use green accents.
- Do not use technical language such as JSON, Supabase, Storage, S3, or API on the public website.
- Keep the release download JavaScript behavior unchanged.
- Preserve the static Hugo deployment model.

---

### Task 1: Website Assets

**Files:**
- Create: `website/static/assets/wolpi/hero.png`
- Create: `website/static/assets/wolpi/cards.png`
- Create: `website/static/assets/wolpi/desktop.png`

**Interfaces:**
- Consumes: source PNG files from `assets/wolpi/`
- Produces: stable website asset URLs under `/assets/wolpi/`

- [ ] Copy three selected Wolpi PNGs into the website static asset folder with ASCII filenames.
- [ ] Verify file sizes are acceptable for static web delivery.

### Task 2: Homepage Template

**Files:**
- Modify: `website/layouts/index.html`

**Interfaces:**
- Consumes: existing download card IDs/classes used by `website/static/js/downloads.js`
- Produces: modernized landing page markup while preserving download element IDs

- [ ] Replace the current homepage layout with app-aligned sections: hero, trust metrics, product pillars, flashcards, screenshots, download, local-first.
- [ ] Keep `id="download-grid"`, `id="detected-download"`, and per-OS `data-os` values unchanged.
- [ ] Use public, non-technical copy for Jura students and Referendare.

### Task 3: Website CSS

**Files:**
- Modify: `website/assets/css/main.css`

**Interfaces:**
- Consumes: class names from `website/layouts/index.html` and existing installation template
- Produces: responsive visual system matching app colors and spacing

- [ ] Replace the old palette with deep app-blue, soft blue, white panels, and muted text.
- [ ] Add responsive hero, card grids, screenshot surfaces, and mobile navigation rules.
- [ ] Keep text readable and avoid overlapping UI at mobile widths.

### Task 4: Build And Verify

**Files:**
- Modify generated output: `docs/`

**Interfaces:**
- Consumes: Hugo website source
- Produces: deployable static site output

- [ ] Run Hugo build.
- [ ] Run website/download tests.
- [ ] Check local static output for key strings and download feed integration.

### Task 5: Deploy

**Files:**
- Modify deploy copy: `jura-supabase/deploy/production/site/`

**Interfaces:**
- Consumes: built website output
- Produces: production website served by Nginx

- [ ] Copy built site to deploy repo production site folder.
- [ ] Rsync production site to `server.02:/home/docker-compose/jura-wolpi/site`.
- [ ] Reload/recreate Nginx if needed.
- [ ] Smoke-check live website and screenshots/download feed.
