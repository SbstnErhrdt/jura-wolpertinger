# Voice Profile Personalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $subagent-driven-development (recommended) or $executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add German-only voice flow controls, one-time Wolpi introductions, and user first/last name profiles.

**Architecture:** Renderer handles voice commands and one-time greeting state. Cloud profile CRUD lives in the existing cloud API wrapper and Supabase RLS. Voice API reads profile first name server-side and passes it into the Realtime prompt.

**Tech Stack:** Vue 3, TypeScript, Vitest, Supabase SQL/RLS, OpenAI Realtime.

## Global Constraints

- No OpenAI API keys in the frontend.
- All voice interaction copy must be German.
- Profile edits happen in a modal, not inline.
- Voice navigation or ending commands must not create review events.

---

### Task 1: Voice Command And Greeting

- [ ] Add failing tests for `end_session`, `introduce` and `firstName`.
- [ ] Implement parser and `startVoiceClient` prompt parameters.
- [ ] Wire `end_session` in `FlashcardsReviewView.vue`.

### Task 2: Profile Model

- [ ] Add shared profile types and AppApi methods.
- [ ] Add Supabase SQL migration with RLS.
- [ ] Implement cloud/local profile read and update.

### Task 3: Home Profile Prompt

- [ ] Add failing Home UI contract test.
- [ ] Add profile completion box and modal on Home.

### Task 4: Voice API Personalization

- [ ] Extend VoiceStore with `getUserProfile`.
- [ ] Pass `firstName` into Realtime client secret creation.
- [ ] Add German-only and personalized greeting prompt assertions.

### Task 5: Verify And Deploy

- [ ] Run targeted tests and typechecks.
- [ ] Build production web app.
- [ ] Apply SQL migration on server.
- [ ] Deploy app bundle and voice API.
- [ ] Smoke test live app and `/voice/health`.
