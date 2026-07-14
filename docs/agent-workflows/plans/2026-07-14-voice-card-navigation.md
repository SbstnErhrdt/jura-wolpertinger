# Voice Card Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $subagent-driven-development (recommended) or $executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lernende koennen in der Sprachwiederholung per Sprache zur naechsten oder vorherigen Karte wechseln.

**Architecture:** Die Realtime-Session transkribiert weiter wie bisher. Der Renderer erkennt Navigationskommandos lokal aus dem Transkript, stoppt die aktuelle Session, wechselt die Karte und startet sofort eine neue Voice-Session. Das Backend instruiert Wolpi, Navigationswuensche nicht zu bewerten.

**Tech Stack:** Vue 3, TypeScript, Vitest, OpenAI Realtime, Supabase-authentifizierte Voice API.

## Global Constraints

- Kein OpenAI API-Key im Frontend.
- Sprachkommandos loesen keine Bewertung und keinen Review-Event aus.
- Wolpi soll nach einem sprachlichen Kartenwechsel direkt die neue Frage stellen.
- Die UI bleibt fuer manuelle Wiederholung weiterhin nutzbar.

---

### Task 1: Command Parser

**Files:**
- Modify: `src/renderer/src/voice/voiceClient.ts`
- Test: `src/renderer/src/voice/voiceClient.test.ts`

**Interfaces:**
- Produces: `parseVoiceCommand(transcript: string): 'next_card' | 'previous_card' | null`
- Consumes: final or partial transcript text.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { parseVoiceCommand } from './voiceClient'

describe('parseVoiceCommand', () => {
  it('detects next-card commands in German transcripts', () => {
    expect(parseVoiceCommand('nächste Karte bitte')).toBe('next_card')
    expect(parseVoiceCommand('weiter zur nächsten')).toBe('next_card')
  })

  it('detects previous-card commands in German transcripts', () => {
    expect(parseVoiceCommand('vorherige Karte')).toBe('previous_card')
    expect(parseVoiceCommand('zurück bitte')).toBe('previous_card')
  })

  it('does not treat answer text as navigation', () => {
    expect(parseVoiceCommand('Der nächste Prüfungspunkt ist die Begründetheit.')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/renderer/src/voice/voiceClient.test.ts`
Expected: FAIL because `parseVoiceCommand` is not exported.

- [ ] **Step 3: Write minimal implementation**

Add a normalized phrase matcher that requires command-like short utterances or explicit command phrases.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/renderer/src/voice/voiceClient.test.ts`
Expected: PASS.

### Task 2: Voice Review Flow

**Files:**
- Modify: `src/renderer/src/voice/voiceClient.ts`
- Modify: `src/renderer/src/views/FlashcardsReviewView.vue`

**Interfaces:**
- Consumes: `VoiceClientCallbacks.onCommand(command)`.
- Produces: automatic restart after `next_card` or `previous_card`.

- [ ] **Step 1: Extend the callback type**

Add `onCommand?(command: VoiceCommand): void` to `VoiceClientCallbacks`.

- [ ] **Step 2: Emit commands before transcript display changes state**

When `parseVoiceCommand` returns a command from a completed transcript, call `onCommand`.

- [ ] **Step 3: Handle command in review view**

Stop the old client, change card through existing `nextCard()` / `previousCard()`, and call `startVoiceReview()` on the next tick.

- [ ] **Step 4: Verify manually**

Run: `pnpm run typecheck`
Expected: PASS.

### Task 3: Agent Instructions

**Files:**
- Modify: `../jura-voice-api/src/openaiRealtime.ts`
- Test: `../jura-voice-api/tests/openaiRealtime.test.ts`

**Interfaces:**
- Produces: Realtime instructions that forbid assessment for navigation requests.

- [ ] **Step 1: Write failing prompt assertions**

Assert instructions mention `naechste Karte`, `vorherige Karte`, no assessment for navigation, and direct new question after app switch.

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test -- tests/openaiRealtime.test.ts`
Expected: FAIL until prompt is updated.

- [ ] **Step 3: Update prompt**

Add concise interaction rules for navigation and no solution leakage.

- [ ] **Step 4: Run tests**

Run: `pnpm test -- tests/openaiRealtime.test.ts && pnpm run typecheck`
Expected: PASS.

### Task 4: Build And Deploy

**Files:**
- Modify if needed: `../jura-supabase/deploy/production/app-dist/`

- [ ] **Step 1: Build web app**

Run: `pnpm run build:web:production`
Expected: production web build succeeds.

- [ ] **Step 2: Deploy web bundle and voice API**

Use the existing `/home/docker-compose/jura-wolpi` deployment on `server.02`.

- [ ] **Step 3: Smoke test**

Check `/voice/health` and live bundle references.
