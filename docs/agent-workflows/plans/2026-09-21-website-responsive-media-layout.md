# Website Responsive Media Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $subagent-driven-development (recommended) or $executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die öffentliche Website rendert Screenshots und Wolpi-Grafiken auf Desktop, Tablet und Mobil unverzerrt in einem professionell begrenzten Layout.

**Architecture:** Ein echter Browser-Regressionscheck lädt Homepage-Markup, Stylesheet und Assets über einen lokalen Testserver. Das Hero-Markup erhält einen zentrierten Inhaltscontainer; zentrale und komponentenspezifische CSS-Regeln sichern Seitenverhältnisse, Maximalbreite und Breakpoints.

**Tech Stack:** Hugo-Templates, CSS, Vitest, Playwright Chromium, Node HTTP server

## Global Constraints

- Keine neue Laufzeitabhängigkeit.
- Produkt-Screenshots behalten 3:2; Wolpi-Grafiken behalten 1:1.
- Desktop, Tablet und Mobil dürfen keinen horizontalen Überlauf erzeugen.
- Bestehende Farben, Texte und Seitenstruktur bleiben erhalten.

---

### Task 1: Browserbasierte Layout-Regression

**Files:**
- Create: `tests/website/layout.test.ts`
- Uses: `website/layouts/index.html`
- Uses: `website/assets/css/main.css`

**Interfaces:**
- Consumes: Homepage-Markup, Website-CSS und statische Bilder.
- Produces: automatisierte Layout-Invarianten für Desktop und Mobil.

- [ ] **Step 1: Write the failing test**

  Erzeuge einen lokalen HTTP-Testserver, öffne die Seite mit Playwright und
  prüfe für Hero-Screenshot, Hero-Wolpi, Karten-Wolpi und Desktop-Wolpi, dass
  gerendertes und natürliches Seitenverhältnis höchstens um 1 % abweichen.
  Prüfe zusätzlich `scrollWidth <= innerWidth` und eine begrenzte Breite des
  Hero-Inhalts.

- [ ] **Step 2: Run test to verify it fails**

  Run: `corepack pnpm exec vitest run tests/website/layout.test.ts`

  Expected: FAIL, weil Hero-Screenshot und Wolpi-Grafiken vertikal gestreckt
  werden und der begrenzte Hero-Inhaltscontainer fehlt.

- [ ] **Step 3: Commit the regression test together with the fix**

  Der Test wird nach dem Red-Green-Zyklus gemeinsam mit der Layoutkorrektur
  committed, damit kein absichtlich roter Zwischenstand gepusht wird.

### Task 2: Hero und Medien robust skalieren

**Files:**
- Modify: `website/layouts/index.html`
- Modify: `website/assets/css/main.css`

**Interfaces:**
- Consumes: bestehende Hero-Texte, Screenshots und transparente Wolpi-PNGs.
- Produces: `.hero-inner` als begrenzte Layoutfläche sowie stabile Bildregeln.

- [ ] **Step 1: Add the centered hero container**

  Umschließe `.hero-copy` und `.hero-product` mit `.hero-inner`. Der äußere
  `.hero` bleibt für Hintergrund und Überlauf zuständig; `.hero-inner` trägt
  Raster, Abstände und `max-width: 1520px`.

- [ ] **Step 2: Make image sizing intrinsic and explicit**

  Ergänze global `height: auto`. Setze Produkt-Screenshot und Wolpi-Grafiken
  zusätzlich auf explizite Seitenverhältnisse und passende `object-fit`-Regeln.

- [ ] **Step 3: Stabilize desktop and mobile composition**

  Begrenze die Produktvorschau, positioniere den Hero-Wolpi außerhalb der
  primären Inhaltsfläche und passe die Breakpoints 1100 px und 760 px an.

- [ ] **Step 4: Run the focused test**

  Run: `corepack pnpm exec vitest run tests/website/layout.test.ts`

  Expected: PASS for desktop and mobile layout invariants.

### Task 3: Vollständige Prüfung, Build und Deployment

**Files:**
- Regenerate: `docs/index.html`
- Regenerate: `docs/css/main.css`

**Interfaces:**
- Consumes: korrigiertes Homepage-Template und Stylesheet.
- Produces: veröffentlichbare statische Website.

- [ ] **Step 1: Run all website tests**

  Run: `corepack pnpm exec vitest run tests/website`

  Expected: alle Website-Tests PASS.

- [ ] **Step 2: Build the Hugo site into a temporary directory**

  Run: `hugo --source website --destination <temporary-directory> --cleanDestinationDir`

  Expected: Build exit code 0.

- [ ] **Step 3: Inspect desktop and mobile screenshots**

  Rendere die gebaute Homepage bei 1440×1000 und 390×844. Prüfe Bildformate,
  Überlagerungen, Lesbarkeit und Überlauf visuell.

- [ ] **Step 4: Regenerate the tracked public website output**

  Kopiere nur die von Hugo erzeugten Website-Dateien nach `docs/`, ohne
  technische Dokumentationsdateien zu löschen.

- [ ] **Step 5: Commit, push and deploy**

  Commit message: `fix: preserve website image proportions`

  Push the current branch, deploy the Hugo output and verify the public page
  plus its CSS and hero image via HTTPS.
