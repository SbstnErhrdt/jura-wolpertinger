# Navigation Interaction Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $subagent-driven-development (recommended) or $executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make hover, active, and keyboard-focus colors consistent across desktop navigation, mobile navigation, and breadcrumbs in both themes.

**Architecture:** Keep all interaction styling centralized in the existing renderer stylesheet so every route inherits identical behavior. Add source-level regression assertions for required state selectors, then verify actual computed colors and layout in the browser.

**Tech Stack:** Vue 3, Nuxt UI 4, CSS, Vitest, in-app Chromium browser

## Global Constraints

- Do not change navigation structure, dimensions, spacing, or typography.
- Use separate contrast-aware Light and Dark Mode colors.
- Preserve icons through `currentColor` and provide a visible `:focus-visible` outline.
- Apply the rules globally to every current and future page using the shared navigation classes.

---

### Task 1: Navigation State Regression Contract

**Files:**
- Modify: `tests/renderer/appShellNuxtUi.test.ts`
- Modify: `tests/renderer/mobileNavigationUi.test.ts`

**Interfaces:**
- Consumes: shared `.nav`, `.mobile-nav`, and `.app-breadcrumb` classes from `main.css`
- Produces: regression assertions for hover, active, focus-visible, and dark-theme selectors

- [ ] **Step 1: Write failing source-level tests**

Assert that `main.css` contains `.nav a:hover`, `.nav a:focus-visible`, `.mobile-nav a:hover`, `.mobile-nav a:focus-visible`, `.app-breadcrumb-link:hover`, `.app-breadcrumb-link:focus-visible`, and dark-theme counterparts for all three navigation types.

- [ ] **Step 2: Run tests and verify RED**

Run: `corepack pnpm vitest run tests/renderer/appShellNuxtUi.test.ts tests/renderer/mobileNavigationUi.test.ts`

Expected: failures for missing hover/focus and dark mobile/breadcrumb rules.

- [ ] **Step 3: Commit the failing contract with the implementation in Task 2**

Task 1 and Task 2 form one atomic behavior change and are committed together after GREEN.

### Task 2: Central Interaction Colors

**Files:**
- Modify: `src/renderer/src/styles/main.css`
- Test: `tests/renderer/appShellNuxtUi.test.ts`
- Test: `tests/renderer/mobileNavigationUi.test.ts`

**Interfaces:**
- Consumes: `--color-primary`, `--color-primary-strong`, theme data attribute, router active classes
- Produces: global CSS state behavior for sidebar, mobile navigation, and breadcrumbs

- [ ] **Step 1: Implement desktop sidebar states**

Add hover with a light translucent surface and white content, keep active visually stronger, and add a two-pixel `:focus-visible` outline with offset. Add dark-theme equivalents with stronger blue-gray surfaces.

- [ ] **Step 2: Implement mobile states**

Add a light-blue hover surface and dark-blue text, a stronger active surface, and the shared focus outline. Add dark-theme background, border, hover, active, and focus colors.

- [ ] **Step 3: Implement breadcrumb states**

Align linked breadcrumb hover with the mobile palette, retain the solid current pill, and add shared focus styling. Add dark-theme container, link, hover, current, separator, and focus rules.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `corepack pnpm vitest run tests/renderer/appShellNuxtUi.test.ts tests/renderer/mobileNavigationUi.test.ts tests/renderer/breadcrumbUi.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/styles/main.css tests/renderer/appShellNuxtUi.test.ts tests/renderer/mobileNavigationUi.test.ts
git commit -m "fix: unify navigation interaction colors"
```

### Task 3: Cross-Page Verification

**Files:**
- Verify: `src/renderer/src/styles/main.css`

**Interfaces:**
- Consumes: the global interaction state rules from Task 2
- Produces: evidence that every route and viewport inherits the states without regressions

- [ ] **Step 1: Run static verification**

Run: `corepack pnpm run typecheck && corepack pnpm vitest run`

Expected: typecheck and all renderer/main/shared tests pass.

- [ ] **Step 2: Verify desktop Light and Dark Mode**

Open representative Home, Karteikarten, Prüfungen, Bewertung, Auswertung, Einstellungen, About, and Hilfe routes at 1440x1000. Capture hover, active, and focus computed styles for sidebar links and breadcrumb links and verify zero horizontal overflow.

- [ ] **Step 3: Verify mobile Light and Dark Mode**

Repeat representative route checks at 390x844. Confirm four stable columns, visible active state, contrasting hover/focus colors, and zero horizontal overflow.

- [ ] **Step 4: Inspect browser logs**

Expected: no renderer errors; the known browser-only Electron bridge warning is acceptable during web preview.
