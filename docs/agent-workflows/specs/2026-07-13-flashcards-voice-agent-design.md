# Flashcards Voice Agent Design

Date: 2026-07-13

## Context

Jura Wolpertinger has a flashcard review flow where users see the front of a card, reveal the back, and rate their recall on a 1-4 scale. The new special feature should let selected users answer flashcards by voice. This is not a simple dictation feature. It should behave like a voice tutor: ask the card, listen to the user, ask short follow-up questions when useful, then automatically rate the answer.

The feature must be globally controllable and user-specific. Most users should not see it until explicitly enabled.

## Goals

- Add a global feature flag system that can enable special capabilities per user.
- Add `flashcards_voice_agent` as the first gated feature.
- Keep OpenAI credentials server-side only.
- Use a realtime voice interaction for browser, desktop, and mobile web.
- Track voice review sessions in the database for auditability, cost control, and debugging.
- Automatically write a flashcard review rating when the assessment confidence is high enough.
- Avoid storing raw audio in the MVP.

## Non-Goals

- No voice mode for exam correction in this iteration.
- No public self-service feature flag UI for normal users.
- No raw audio retention in the MVP.
- No automatic card creation from voice input.
- No replacement of the existing manual review flow.

## OpenAI Architecture

The implementation should use OpenAI Realtime voice sessions over WebRTC for client-side audio. The OpenAI docs recommend WebRTC for browser and mobile clients that capture and play audio directly. The server creates short-lived credentials or establishes the session through the unified Realtime interface, and the standard OpenAI API key remains on the server.

The voice model starts as `gpt-realtime-2.1`. The backend sets `OpenAI-Safety-Identifier` using a stable, privacy-preserving hash of the Supabase user ID.

The Realtime agent handles the live conversation. A separate structured assessment step records the final rating decision. Keeping the assessment separate from the live conversation makes the result easier to audit, test, and tune.

## High-Level Flow

1. The user opens a flashcard review session.
2. The app loads feature flags for the signed-in user.
3. If `flashcards_voice_agent` is active, the current card shows a "Mit Wolpi sprechen" action.
4. The user starts the voice mode.
5. The app calls `POST /voice/sessions` with the Supabase access token and the current card ID.
6. `jura-voice-api` validates the token, feature flag, rate limit, and card access.
7. `jura-voice-api` creates a voice review session row.
8. The backend creates an OpenAI Realtime session and returns the client connection payload.
9. The client connects with WebRTC and the voice agent runs the live exchange.
10. The backend stores transcript and relevant session events.
11. When the interaction ends, the backend runs a structured assessment using the card front, card back, transcript, and any follow-up context.
12. If confidence is at or above the configured threshold, the backend records the rating through the same scheduling semantics as the existing review flow.
13. The UI shows the rating, explanation, missed points, and moves to the next card.

## Routing And Backend

Add a dedicated service:

```text
https://app.jura-wolpi.de/voice/* -> jura-voice-api
```

Nginx routes `/voice/*` to the new service. The existing `/api/*` route continues to point at Supabase Kong. The voice service should not be forced into Supabase Kong because it owns application-specific business logic, OpenAI credentials, cost controls, and session auditing.

The service can be a small Node.js HTTP service. It should run in the same Docker network as Supabase and receive only server-side secrets:

- `OPENAI_API_KEY`
- Supabase project URL/internal URL
- Supabase service role key or database connection string
- feature flag and rate-limit configuration

## Authentication And Authorization

The client sends the Supabase access token to `jura-voice-api`.

The service verifies:

- the token is valid
- the user exists
- the user has `flashcards_voice_agent`
- the user can read the requested card through collection ownership/membership/public access rules
- the current usage is below configured limits

Authorization must be enforced server-side even if the frontend hides the button.

## Feature Flags

Add persistent feature flag tables:

- `feature_flags`
  - `key`
  - `description`
  - `enabled_globally`
  - `created_at`
  - `updated_at`
- `user_feature_flags`
  - `user_id`
  - `feature_key`
  - `enabled`
  - `created_by_user_id`
  - `created_at`
  - `updated_at`
- `feature_flag_audit_log`
  - actor, target user, feature key, old value, new value, timestamp

Normal users may read only their own effective feature flags. Writes happen through admin/server paths only. The app consumes effective flags from a small endpoint or RPC and treats missing flags as disabled.

## Voice Review Data Model

Add voice-specific tables:

- `voice_review_sessions`
  - `id`
  - `user_id`
  - `prompt_id`
  - `status`
  - `started_at`
  - `ended_at`
  - `model`
  - `voice`
  - `agent_version`
  - `assessment_version`
  - `review_event_id`
  - `error_code`
- `voice_review_events`
  - `id`
  - `session_id`
  - `event_type`
  - `payload_json`
  - `created_at`
- `voice_review_assessments`
  - `id`
  - `session_id`
  - `rating`
  - `confidence`
  - `reason`
  - `matched_points_json`
  - `missed_points_json`
  - `next_step`
  - `raw_assessment_json`
  - `created_at`

The MVP stores transcript text and structured events, not raw audio. If raw audio is ever added later, it must use private Supabase Storage with a separate retention policy.

## Assessment Semantics

The voice agent should not directly write scheduler ratings. It collects the live answer and context. A structured assessment step then produces:

- `rating`: 1 to 4, matching the existing review scale
- `confidence`: `low`, `medium`, or `high`
- `reason`: short user-facing explanation
- `matched_points`: key parts that were present
- `missed_points`: key parts that were missing or unclear
- `next_step`: one concise learning suggestion

Default confidence rule:

- `medium` or `high`: record the review automatically
- `low`: do not update the scheduler; show "Antwort konnte nicht sicher bewertet werden"

If the user explicitly chose fully automatic practice, low-confidence cards should remain in the current session and be shown again manually or by voice.

## Prompting

The realtime voice agent prompt should be short and operational:

- Act as a focused Jura flashcard tutor.
- Ask only the current flashcard.
- Let the user answer without long interruptions.
- Ask at most one short follow-up if the answer is ambiguous.
- Do not reveal the back side before the answer phase ends.
- Do not mention implementation details, model names, or scoring internals.
- End the turn with a clear signal for assessment.

The assessment prompt should be deterministic and structured:

- Compare the answer against the card back side.
- Reward legally correct equivalent formulations.
- Penalize missing issue spotting, wrong legal structure, or materially wrong conclusions.
- Use the 1-4 review scale consistently:
  - 1: not recalled or materially wrong
  - 2: partially recalled, important gaps
  - 3: substantially correct
  - 4: confident, complete, and well structured
- Return strict JSON matching the assessment schema.

## User Experience

The existing review screen remains the base experience. Voice mode is an additional action on the active card.

Visible states:

- `Bereit`: "Mit Wolpi sprechen"
- `Verbindet`: microphone/session setup
- `Hört zu`: user is speaking
- `Fragt nach`: agent asks a short follow-up
- `Bewertet`: assessment is running
- `Ergebnis`: result card with rating and explanation
- `Nicht sicher`: no scheduler update, user can repeat or rate manually

The UI should show a clear microphone permission error if the browser or desktop shell blocks audio input. It should also allow ending the voice answer manually.

## Privacy And Safety

- The user must explicitly start each voice session.
- The app should not start microphone capture automatically.
- Store transcript and assessment; do not store raw audio in the MVP.
- Keep OpenAI API keys server-side.
- Set `OpenAI-Safety-Identifier` server-side from a hashed user ID.
- Add per-user rate limits and a server kill switch.
- Make voice feature flags default to disabled.

## Local And Cloud Behavior

Cloud web requires an online account and uses `jura-voice-api`.

Desktop can use voice only when connected to the online account, because the OpenAI key and feature authorization live on the server. In standalone local-only mode, the voice button is hidden and the manual flashcard flow remains unchanged.

## Error Handling

If voice setup fails:

- show a short user-facing message
- keep the current card active
- allow manual review

If assessment fails:

- mark the voice session as failed
- do not write a scheduler rating
- allow the user to rate manually

If the user loses connectivity:

- close the realtime session
- preserve the current flashcard session
- do not write partial ratings

## Testing Strategy

Database tests:

- feature flag RLS
- only enabled users can read their effective flag
- voice session rows are scoped to the owner
- low-confidence assessments do not create review events
- medium/high-confidence assessments create review events with existing scheduler semantics

Service tests:

- rejects missing/invalid Supabase JWT
- rejects users without the feature flag
- rejects inaccessible cards
- creates realtime credentials without exposing the standard OpenAI key
- stores transcript and assessment
- respects rate limits

Frontend tests:

- button hidden when feature flag is disabled
- button visible when enabled
- microphone permission error is understandable
- low-confidence result does not advance scheduler
- successful automatic rating advances to the next card

End-to-end smoke:

- mocked OpenAI session creates an assessment and writes a review event
- desktop connected to cloud sees the same gated behavior as web

## Rollout

1. Build feature flag foundation.
2. Build `jura-voice-api` skeleton with auth and flag checks.
3. Add voice session DB schema.
4. Add frontend gated voice entry point.
5. Add mocked realtime flow for tests.
6. Add OpenAI Realtime integration behind server environment config.
7. Enable for one internal user.
8. Review transcripts, costs, latency, and rating quality before wider rollout.

## MVP Defaults

- Limit the first rollout to 20 completed voice sessions per user per day. Failed setup attempts do not count; sessions that reach assessment count.
- Manage feature flags via SQL/server tooling for the first internal rollout. A dedicated admin UI is deferred until usage proves the workflow.
- Retain transcripts and structured events for 30 days by default, then delete or anonymize them through a scheduled cleanup job. Keep assessment summaries and review events because they are part of the learning history.
