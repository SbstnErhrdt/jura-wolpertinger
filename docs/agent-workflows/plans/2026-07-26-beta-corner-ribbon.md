# Beta Corner Ribbon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $subagent-driven-development (recommended) or $executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the clipped beta band with a clean diagonal corner ribbon in the desktop sidebar.

**Architecture:** A dedicated non-interactive wrapper owns positioning and clipping at the sidebar corner. The existing `.beta-banner` remains responsible for the red band, typography, shadow, and rotation.

**Tech Stack:** Vue 3 SFC markup, CSS, Vitest source-contract tests

## Global Constraints

- Keep the existing 240px desktop sidebar and navigation structure unchanged.
- Keep `BETA` fully readable without overlapping the logo or product name.
- Hide the ribbon together with the desktop sidebar below 1100px.
- Preserve identical ribbon styling in light and dark modes.

---

### Task 1: Corner Ribbon Structure And Styling

**Files:**
- Modify: `tests/renderer/appShellNuxtUi.test.ts`
- Modify: `src/renderer/src/App.vue`
- Modify: `src/renderer/src/styles/main.css`

**Interfaces:**
- Consumes: Existing `.sidebar`, `.brand`, and `.beta-banner` elements.
- Produces: A `.beta-banner-corner` wrapper containing the existing `.beta-banner`.

- [x] **Step 1: Write the failing UI contract test**

Update the beta test to require `class="beta-banner-corner"`, an absolutely positioned 72px corner wrapper with hidden overflow, and a rotated inner banner without translation-based placement.

- [x] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/renderer/appShellNuxtUi.test.ts`

Expected: FAIL because `.beta-banner-corner` does not exist.

- [x] **Step 3: Add the wrapper and minimal CSS**

Wrap the existing beta element in:

```vue
<div class="beta-banner-corner" aria-hidden="true">
  <div class="beta-banner" aria-label="Beta-Version">BETA</div>
</div>
```

Give the wrapper fixed corner dimensions, absolute top/right positioning, controlled hidden overflow, and pointer-event suppression. Center the inner band inside the wrapper and rotate it 45 degrees without translate offsets.

- [x] **Step 4: Run focused verification**

Run:

```bash
pnpm vitest run tests/renderer/appShellNuxtUi.test.ts tests/renderer/mobileNavigationUi.test.ts
pnpm run typecheck
```

Expected: All focused tests pass and typecheck exits with code 0.

- [x] **Step 5: Verify visually**

Build or start the renderer, inspect the desktop sidebar at a viewport wider than 1100px, and confirm the complete `BETA` label, clean diagonal edges, and no brand overlap.
