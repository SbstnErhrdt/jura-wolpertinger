# Direct Password Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $subagent-driven-development (recommended) or $executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Password reset emails should open the Jura Wolpi web app directly and let the app verify the recovery token.

**Architecture:** Supabase Auth still sends recovery emails, but the email template links to the frontend with `token_hash` and `type=recovery`. The Vue app verifies the token with `supabase.auth.verifyOtp`, removes the token from the visible URL, and shows the existing new-password form.

**Tech Stack:** Vue renderer, Supabase JS Auth, static Supabase Auth email templates, nginx-served production assets.

## Global Constraints

- User-facing copy must not mention Supabase or backend details.
- Keep the old hash-based `PASSWORD_RECOVERY` flow as a fallback for already-sent emails.
- Do not expose SMTP secrets in code, commits, logs, or output.
- The Wolpi email image must use an absolute HTTPS URL.

---

### Task 1: Lock Direct Recovery Flow With Tests

**Files:**
- Modify: `tests/renderer/appShellNuxtUi.test.ts`

**Interfaces:**
- Consumes: existing source-string based renderer shell tests.
- Produces: assertions that the app supports `token_hash`, `type=recovery`, `verifyOtp`, and URL cleanup.

- [ ] Add assertions to the existing cloud auth test:
  - `verifyOtp`
  - `token_hash`
  - `type=recovery`
  - `history.replaceState`

- [ ] Run: `corepack pnpm vitest run tests/renderer/appShellNuxtUi.test.ts`
  Expected: fails before implementation because `verifyOtp` and `token_hash` are not in `App.vue`.

### Task 2: Implement Frontend Token Verification

**Files:**
- Modify: `src/renderer/src/App.vue`

**Interfaces:**
- Consumes: `getSupabaseAuthClient()`, existing `authMode`, `authMessage`, and password update form.
- Produces: `verifyRecoveryTokenFromUrl()` that verifies direct recovery links.

- [ ] Add a helper that reads `window.location.search`, checks `token_hash` and `type=recovery`, calls `client.auth.verifyOtp({ token_hash, type: 'recovery' })`, then switches to `update_password`.
- [ ] Remove `token_hash` and `type` from the URL with `history.replaceState`.
- [ ] Keep the old `window.location.hash.includes('type=recovery')` fallback.
- [ ] Run the renderer test again and make it pass.

### Task 3: Update Recovery Email Template

**Files:**
- Modify: `../jura-supabase/deploy/production/auth-email/recovery.html`

**Interfaces:**
- Consumes: Supabase email variables `{{ .RedirectTo }}` and `{{ .TokenHash }}`.
- Produces: direct frontend link `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery`.

- [ ] Replace the `{{ .ConfirmationURL }}` button and fallback link.
- [ ] Add `https://app.jura-wolpi.de/assets/hello.png` as the branded image.
- [ ] Keep all copy German and non-technical.

### Task 4: Build, Deploy, Verify

**Files:**
- Production app assets under `../jura-supabase/deploy/production/app/`.
- Server files under `/home/docker-compose/jura-wolpi` and `/home/docker-compose/jura-supabase-wolpi`.

**Interfaces:**
- Consumes: production env with `/api` Supabase URL and anon key.
- Produces: deployed app and email template.

- [ ] Build web production app.
- [ ] Copy renderer assets to local deployment folder and server app folder.
- [ ] Copy recovery email template to server.
- [ ] Reload nginx and recreate auth container.
- [ ] Verify image URL, template URL, reset endpoint, and app recovery route.
- [ ] Commit and push app repo; commit deployment repo locally.
