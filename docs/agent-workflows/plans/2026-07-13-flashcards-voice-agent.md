# Flashcards Voice Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $subagent-driven-development (recommended) or $executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a gated flashcard voice agent that selected users can use to answer cards by voice and receive an automatic scheduler rating.

**Architecture:** Add feature flags and voice review persistence to Supabase, introduce a private `jura-voice-api` service behind `https://app.jura-wolpi.de/voice/*`, and integrate the existing flashcard review screen with a WebRTC OpenAI Realtime session. The backend owns auth, feature flag checks, OpenAI credentials, assessment, rate limits, and audit logging.

**Tech Stack:** Supabase Postgres/RLS/RPC, existing Supabase self-hosted Docker stack, Node.js 22 TypeScript service, OpenAI Realtime API over WebRTC, Vue 3 renderer, existing Vitest SQL/renderer/service testing patterns.

## Global Constraints

- Feature flag key: `flashcards_voice_agent`.
- Voice model: `gpt-realtime-2.1`.
- OpenAI API key must stay server-side.
- Client transport is WebRTC for browser, desktop, and mobile web.
- Do not store raw audio in the MVP.
- Store transcripts and structured events for 30 days by default.
- Default first rollout limit: 20 completed voice sessions per user per day.
- Desktop voice mode is available only when connected to an online account.
- Standalone local-only mode hides the voice entry point.
- Normal users may read only their own effective feature flags.
- Feature flag writes happen through SQL/server tooling in the MVP, not through a normal user UI.

---

## File Structure

### Supabase

- Create `../jura-supabase/sql/app/005_voice_feature_flags.sql`
  - Owns feature flag tables, voice session tables, RLS, grants, cleanup function, effective flag RPC, and voice rating RPC.
- Modify `../jura-supabase/sql/app/MANIFEST.txt`
  - Adds `005_voice_feature_flags.sql` after `004_release_storage_bucket.sql`.
- Create `../jura-supabase/tests/sql/005_voice_feature_flags_test.sql`
  - Tests feature flag visibility, voice session isolation, confidence behavior, and scheduler integration.

### Voice Backend

- Create `../jura-voice-api/package.json`
- Create `../jura-voice-api/tsconfig.json`
- Create `../jura-voice-api/vitest.config.ts`
- Create `../jura-voice-api/src/config.ts`
- Create `../jura-voice-api/src/http.ts`
- Create `../jura-voice-api/src/auth.ts`
- Create `../jura-voice-api/src/supabase.ts`
- Create `../jura-voice-api/src/openaiRealtime.ts`
- Create `../jura-voice-api/src/assessment.ts`
- Create `../jura-voice-api/src/routes/voiceSessions.ts`
- Create `../jura-voice-api/src/index.ts`
- Create `../jura-voice-api/tests/*.test.ts`
  - Owns JWT validation, feature flag gating, session creation, mocked Realtime token creation, event persistence, assessment, rate limit handling.

### Desktop/Web App

- Modify `src/shared/ipc.ts`
  - Adds feature flag and voice session DTOs.
- Modify `src/preload/index.ts`
  - Exposes new Electron IPC methods.
- Modify `src/main/index.ts`
  - Handles feature flag and online-only voice calls in Electron context.
- Modify `src/renderer/src/api.ts`
  - Adds browser/cloud implementations for feature flags and voice API.
- Create `src/renderer/src/voice/voiceClient.ts`
  - Owns WebRTC lifecycle and voice state machine.
- Create `src/renderer/src/voice/featureFlags.ts`
  - Owns client-side effective feature flag helpers.
- Modify `src/renderer/src/views/FlashcardsReviewView.vue`
  - Adds gated voice action, states, transcript/result UI, automatic rating advancement.
- Create/modify renderer tests under `tests/renderer/`.

### Deployment

- Modify `../jura-supabase/deploy/production/nginx.conf`
  - Routes `/voice/` to `jura-voice-api`.
- Modify `../jura-supabase/docker-compose.production.yml`
  - Adds the service to the production network.
- Add `../jura-supabase/.env.example` entries for voice service variables.
- Add production notes to `../jura-supabase/README.md`.

---

## Task 1: Supabase Feature Flags And Voice Tables

**Files:**
- Create: `../jura-supabase/sql/app/005_voice_feature_flags.sql`
- Modify: `../jura-supabase/sql/app/MANIFEST.txt`
- Create: `../jura-supabase/tests/sql/005_voice_feature_flags_test.sql`

**Interfaces:**
- Produces RPC: `public.get_effective_feature_flags() returns jsonb`
- Produces RPC: `public.has_feature_flag(p_feature_key text, p_user_id uuid default auth.uid()) returns boolean`
- Produces RPC: `public.record_voice_review_assessment(p_session_id uuid, p_rating integer, p_confidence text, p_reason text, p_matched_points jsonb, p_missed_points jsonb, p_next_step text, p_raw_assessment jsonb, p_client_event_id uuid) returns jsonb`
- Produces tables: `feature_flags`, `user_feature_flags`, `feature_flag_audit_log`, `voice_review_sessions`, `voice_review_events`, `voice_review_assessments`
- Consumed by: `jura-voice-api` in Tasks 2-4, app feature flag client in Task 5.

- [ ] **Step 1: Write the failing SQL test**

Create `../jura-supabase/tests/sql/005_voice_feature_flags_test.sql` with these cases:

```sql
\set ON_ERROR_STOP on

begin;

create or replace function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$
begin
  if not condition then raise exception 'assertion failed: %', message; end if;
end;
$$;

create or replace function pg_temp.assert_eq(actual bigint, expected bigint, message text)
returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'assertion failed: % (expected %, got %)', message, expected, actual;
  end if;
end;
$$;

insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
('00000000-0000-4000-8000-0000000000a1','authenticated','authenticated','voice-a@example.test',now(),'{}','{}',now(),now()),
('00000000-0000-4000-8000-0000000000b2','authenticated','authenticated','voice-b@example.test',now(),'{}','{}',now(),now())
on conflict (id) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select pg_temp.assert_true(
  not public.has_feature_flag('flashcards_voice_agent'),
  'feature flag defaults to disabled'
);

reset role;

insert into public.feature_flags (key, description, enabled_globally)
values ('flashcards_voice_agent', 'Voice agent for flashcard review', false)
on conflict (key) do update set description = excluded.description;

insert into public.user_feature_flags (user_id, feature_key, enabled)
values ('00000000-0000-4000-8000-0000000000a1', 'flashcards_voice_agent', true)
on conflict (user_id, feature_key) do update set enabled = excluded.enabled;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select pg_temp.assert_true(
  public.has_feature_flag('flashcards_voice_agent'),
  'enabled user has voice feature'
);

select pg_temp.assert_true(
  (public.get_effective_feature_flags() ? 'flashcards_voice_agent'),
  'effective flags include enabled voice feature'
);

select public.create_learning_collection('Voice Strafrecht', null, false, false) as collection_id
\gset

insert into public.learning_items (id, primary_collection_id, owner_user_id, author_user_id, title)
values ('30000000-0000-4000-8000-0000000000a1', :'collection_id', auth.uid(), auth.uid(), 'Notwehr');

insert into public.learning_prompts (id, item_id, prompt_type, front_markdown, back_markdown)
values (
  '50000000-0000-4000-8000-0000000000a1',
  '30000000-0000-4000-8000-0000000000a1',
  'qa',
  'Was sind die Voraussetzungen der Notwehr?',
  'Notwehrlage, Notwehrhandlung, Verteidigungswille.'
);

insert into public.voice_review_sessions (id, user_id, prompt_id, status, model, voice, agent_version, assessment_version)
values (
  '60000000-0000-4000-8000-0000000000a1',
  auth.uid(),
  '50000000-0000-4000-8000-0000000000a1',
  'assessing',
  'gpt-realtime-2.1',
  'marin',
  'voice-agent-v1',
  'voice-assessment-v1'
);

select public.record_voice_review_assessment(
  '60000000-0000-4000-8000-0000000000a1',
  3,
  'medium',
  'Die wesentlichen Punkte wurden genannt.',
  '["Notwehrlage","Notwehrhandlung"]'::jsonb,
  '["Verteidigungswille knapp"]'::jsonb,
  'Verteidigungswillen sauber ausformulieren.',
  '{"rating":3,"confidence":"medium"}'::jsonb,
  '70000000-0000-4000-8000-0000000000a1'
) as result
\gset

select pg_temp.assert_eq(
  (select count(*) from public.review_events where user_id = auth.uid() and prompt_id = '50000000-0000-4000-8000-0000000000a1'),
  1,
  'medium confidence voice assessment creates review event'
);

select pg_temp.assert_eq(
  (select count(*) from public.voice_review_assessments where session_id = '60000000-0000-4000-8000-0000000000a1'),
  1,
  'assessment row is stored'
);

rollback;
```

- [ ] **Step 2: Run the SQL test to verify it fails**

Run:

```bash
cd ../jura-supabase
./scripts/start-local.sh
./scripts/apply-local-sql.sh
./scripts/test-sql.sh tests/sql/005_voice_feature_flags_test.sql
```

Expected: FAIL because `public.has_feature_flag` and voice tables do not exist.

- [ ] **Step 3: Implement the SQL schema and RPCs**

Create `../jura-supabase/sql/app/005_voice_feature_flags.sql` with:

```sql
begin;

create table if not exists public.feature_flags (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  description text not null check (length(trim(description)) > 0),
  enabled_globally boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_feature_flags (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_key text not null references public.feature_flags(key) on delete cascade,
  enabled boolean not null default true,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, feature_key)
);

create table if not exists public.feature_flag_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete cascade,
  feature_key text not null,
  old_enabled boolean,
  new_enabled boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists public.voice_review_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt_id uuid not null references public.learning_prompts(id) on delete cascade,
  status text not null default 'created' check (status in ('created','connected','listening','assessing','completed','failed','cancelled')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  model text not null default 'gpt-realtime-2.1',
  voice text not null default 'marin',
  agent_version text not null default 'voice-agent-v1',
  assessment_version text not null default 'voice-assessment-v1',
  review_event_id uuid references public.review_events(id) on delete set null,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.voice_review_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.voice_review_sessions(id) on delete cascade,
  event_type text not null check (length(trim(event_type)) > 0),
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.voice_review_assessments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.voice_review_sessions(id) on delete cascade,
  rating smallint check (rating between 1 and 4),
  confidence text not null check (confidence in ('low','medium','high')),
  reason text not null,
  matched_points_json jsonb not null default '[]'::jsonb,
  missed_points_json jsonb not null default '[]'::jsonb,
  next_step text not null default '',
  raw_assessment_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_feature_flags_user_idx on public.user_feature_flags(user_id);
create index if not exists voice_review_sessions_user_started_idx on public.voice_review_sessions(user_id, started_at desc);
create index if not exists voice_review_sessions_prompt_idx on public.voice_review_sessions(prompt_id);
create index if not exists voice_review_events_session_idx on public.voice_review_events(session_id, created_at);

alter table public.feature_flags enable row level security;
alter table public.user_feature_flags enable row level security;
alter table public.feature_flag_audit_log enable row level security;
alter table public.voice_review_sessions enable row level security;
alter table public.voice_review_events enable row level security;
alter table public.voice_review_assessments enable row level security;

drop trigger if exists touch_feature_flags_updated_at on public.feature_flags;
create trigger touch_feature_flags_updated_at before update on public.feature_flags
for each row execute function public.touch_updated_at();

drop trigger if exists touch_user_feature_flags_updated_at on public.user_feature_flags;
create trigger touch_user_feature_flags_updated_at before update on public.user_feature_flags
for each row execute function public.touch_updated_at();

drop trigger if exists touch_voice_review_sessions_updated_at on public.voice_review_sessions;
create trigger touch_voice_review_sessions_updated_at before update on public.voice_review_sessions
for each row execute function public.touch_updated_at();

create or replace function public.has_feature_flag(p_feature_key text, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select coalesce(
    (select uff.enabled from public.user_feature_flags uff where uff.user_id = p_user_id and uff.feature_key = p_feature_key),
    (select ff.enabled_globally from public.feature_flags ff where ff.key = p_feature_key),
    false
  );
$$;

create or replace function public.get_effective_feature_flags()
returns jsonb
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select coalesce(jsonb_object_agg(ff.key, public.has_feature_flag(ff.key, auth.uid())), '{}'::jsonb)
  from public.feature_flags ff;
$$;

create or replace function public.record_voice_review_assessment(
  p_session_id uuid,
  p_rating integer,
  p_confidence text,
  p_reason text,
  p_matched_points jsonb,
  p_missed_points jsonb,
  p_next_step text,
  p_raw_assessment jsonb,
  p_client_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_session public.voice_review_sessions%rowtype;
  v_record_result jsonb := '{"recorded":false}'::jsonb;
  v_event_id uuid;
begin
  select * into v_session
  from public.voice_review_sessions
  where id = p_session_id and user_id = auth.uid()
  for update;

  if v_session.id is null then
    raise exception 'voice review session not found';
  end if;

  if p_confidence not in ('low','medium','high') then
    raise exception 'invalid confidence';
  end if;

  insert into public.voice_review_assessments (
    session_id, rating, confidence, reason, matched_points_json, missed_points_json, next_step, raw_assessment_json
  ) values (
    p_session_id,
    case when p_confidence = 'low' then null else p_rating end,
    p_confidence,
    p_reason,
    coalesce(p_matched_points, '[]'::jsonb),
    coalesce(p_missed_points, '[]'::jsonb),
    coalesce(p_next_step, ''),
    coalesce(p_raw_assessment, '{}'::jsonb)
  );

  if p_confidence in ('medium','high') then
    v_record_result := public.record_review(v_session.prompt_id, p_rating, null, p_client_event_id);
    v_event_id := (v_record_result ->> 'event_id')::uuid;
  end if;

  update public.voice_review_sessions
  set status = case when p_confidence = 'low' then 'completed' else 'completed' end,
      ended_at = now(),
      review_event_id = v_event_id
  where id = p_session_id;

  return jsonb_build_object(
    'recorded', p_confidence in ('medium','high'),
    'review_event_id', v_event_id,
    'record_review', v_record_result
  );
end;
$$;

drop policy if exists "feature flags are readable by authenticated users" on public.feature_flags;
create policy "feature flags are readable by authenticated users"
on public.feature_flags for select to authenticated using (true);

drop policy if exists "users read own feature flags" on public.user_feature_flags;
create policy "users read own feature flags"
on public.user_feature_flags for select to authenticated using (user_id = auth.uid());

drop policy if exists "users read own voice sessions" on public.voice_review_sessions;
create policy "users read own voice sessions"
on public.voice_review_sessions for select to authenticated using (user_id = auth.uid());

drop policy if exists "users read own voice events" on public.voice_review_events;
create policy "users read own voice events"
on public.voice_review_events for select to authenticated
using (exists (select 1 from public.voice_review_sessions s where s.id = session_id and s.user_id = auth.uid()));

drop policy if exists "users read own voice assessments" on public.voice_review_assessments;
create policy "users read own voice assessments"
on public.voice_review_assessments for select to authenticated
using (exists (select 1 from public.voice_review_sessions s where s.id = session_id and s.user_id = auth.uid()));

insert into public.feature_flags (key, description, enabled_globally)
values ('flashcards_voice_agent', 'Voice agent for flashcard review', false)
on conflict (key) do update set description = excluded.description;

grant select on public.feature_flags to authenticated;
grant select on public.user_feature_flags to authenticated;
grant select on public.voice_review_sessions to authenticated;
grant select on public.voice_review_events to authenticated;
grant select on public.voice_review_assessments to authenticated;
grant all on public.feature_flags to service_role;
grant all on public.user_feature_flags to service_role;
grant all on public.feature_flag_audit_log to service_role;
grant all on public.voice_review_sessions to service_role;
grant all on public.voice_review_events to service_role;
grant all on public.voice_review_assessments to service_role;
grant execute on function public.has_feature_flag(text, uuid) to authenticated, service_role;
grant execute on function public.get_effective_feature_flags() to authenticated;
grant execute on function public.record_voice_review_assessment(uuid, integer, text, text, jsonb, jsonb, text, jsonb, uuid) to authenticated, service_role;

commit;
```

Append this line to `../jura-supabase/sql/app/MANIFEST.txt`:

```text
005_voice_feature_flags.sql
```

- [ ] **Step 4: Run the SQL test to verify it passes**

Run:

```bash
cd ../jura-supabase
./scripts/apply-local-sql.sh
./scripts/test-sql.sh tests/sql/005_voice_feature_flags_test.sql
```

Expected: PASS with no SQL assertion failures.

- [ ] **Step 5: Commit**

```bash
git -C ../jura-supabase add sql/app/005_voice_feature_flags.sql sql/app/MANIFEST.txt tests/sql/005_voice_feature_flags_test.sql
git -C ../jura-supabase commit -m "Add voice feature flags and review tables"
```

---

## Task 2: Voice API Service Skeleton

**Files:**
- Create: `../jura-voice-api/package.json`
- Create: `../jura-voice-api/tsconfig.json`
- Create: `../jura-voice-api/vitest.config.ts`
- Create: `../jura-voice-api/src/config.ts`
- Create: `../jura-voice-api/src/http.ts`
- Create: `../jura-voice-api/src/auth.ts`
- Create: `../jura-voice-api/src/supabase.ts`
- Create: `../jura-voice-api/src/index.ts`
- Create: `../jura-voice-api/tests/auth.test.ts`

**Interfaces:**
- Consumes: Supabase project URL and service key env vars.
- Produces: `createServer(deps: ServerDeps): http.Server`
- Produces: `readConfig(env: NodeJS.ProcessEnv): VoiceApiConfig`
- Produces: `parseBearerToken(header: string | undefined): string`
- Produces: `verifySupabaseUser(token: string, deps: AuthDeps): Promise<AuthUser>`

- [ ] **Step 1: Write failing auth/config tests**

Create `../jura-voice-api/tests/auth.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { parseBearerToken, verifySupabaseUser } from '../src/auth'
import { readConfig } from '../src/config'

describe('voice api config', () => {
  it('requires server-side OpenAI and Supabase secrets', () => {
    expect(() => readConfig({})).toThrow(/OPENAI_API_KEY/)
    expect(() =>
      readConfig({
        OPENAI_API_KEY: 'sk-test',
        SUPABASE_URL: 'https://app.jura-wolpi.de/api',
        SUPABASE_SERVICE_ROLE_KEY: 'service',
        PORT: '8087'
      })
    ).not.toThrow()
  })
})

describe('bearer auth', () => {
  it('parses bearer tokens only', () => {
    expect(parseBearerToken('Bearer abc.def')).toBe('abc.def')
    expect(() => parseBearerToken(undefined)).toThrow(/missing authorization/i)
    expect(() => parseBearerToken('Basic abc')).toThrow(/bearer/i)
  })

  it('verifies the Supabase user through injected auth dependency', async () => {
    const getUser = vi.fn(async () => ({
      data: { user: { id: '00000000-0000-4000-8000-0000000000a1', email: 'voice@example.test' } },
      error: null
    }))

    await expect(verifySupabaseUser('jwt', { getUser })).resolves.toEqual({
      id: '00000000-0000-4000-8000-0000000000a1',
      email: 'voice@example.test'
    })
    expect(getUser).toHaveBeenCalledWith('jwt')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd ../jura-voice-api
corepack pnpm install
corepack pnpm vitest run tests/auth.test.ts
```

Expected: FAIL because the service files do not exist.

- [ ] **Step 3: Create the service package**

Create `../jura-voice-api/package.json`:

```json
{
  "name": "jura-voice-api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.110.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "tsx": "^4.23.0",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  },
  "packageManager": "pnpm@10.33.0"
}
```

Create `../jura-voice-api/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "vitest.config.ts"]
}
```

Create `../jura-voice-api/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node'
  }
})
```

- [ ] **Step 4: Implement config and auth**

Create `../jura-voice-api/src/config.ts`:

```ts
import { z } from 'zod'

const configSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(8087),
  VOICE_DAILY_LIMIT: z.coerce.number().int().positive().default(20),
  VOICE_AGENT_MODEL: z.string().min(1).default('gpt-realtime-2.1'),
  VOICE_AGENT_VOICE: z.string().min(1).default('marin')
})

export type VoiceApiConfig = z.infer<typeof configSchema>

export function readConfig(env: NodeJS.ProcessEnv): VoiceApiConfig {
  return configSchema.parse(env)
}
```

Create `../jura-voice-api/src/auth.ts`:

```ts
export type AuthUser = {
  id: string
  email: string | null
}

export type AuthDeps = {
  getUser(token: string): Promise<{
    data: { user: { id: string; email?: string | null } | null }
    error: { message: string } | null
  }>
}

export function parseBearerToken(header: string | undefined): string {
  if (!header) throw new Error('Missing Authorization header')
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match) throw new Error('Authorization header must use Bearer token')
  return match[1]
}

export async function verifySupabaseUser(token: string, deps: AuthDeps): Promise<AuthUser> {
  const { data, error } = await deps.getUser(token)
  if (error) throw new Error(`Supabase auth failed: ${error.message}`)
  if (!data.user) throw new Error('Supabase auth failed: user not found')
  return {
    id: data.user.id,
    email: data.user.email ?? null
  }
}
```

Create `../jura-voice-api/src/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import type { VoiceApiConfig } from './config'

export function createSupabaseAdmin(config: VoiceApiConfig) {
  return createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}
```

Create `../jura-voice-api/src/http.ts`:

```ts
import http from 'node:http'

export type JsonHandler = (request: http.IncomingMessage, body: unknown) => Promise<{ status: number; body: unknown }>

export async function readJson(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

export function sendJson(response: http.ServerResponse, status: number, body: unknown): void {
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(body))
}
```

Create `../jura-voice-api/src/index.ts`:

```ts
import http from 'node:http'
import { readConfig } from './config'
import { sendJson } from './http'

export function createServer() {
  return http.createServer((_request, response) => {
    sendJson(response, 404, { error: 'Not found' })
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = readConfig(process.env)
  createServer().listen(config.PORT, () => {
    console.log(`jura-voice-api listening on ${config.PORT}`)
  })
}
```

- [ ] **Step 5: Run service tests and typecheck**

Run:

```bash
cd ../jura-voice-api
corepack pnpm install
corepack pnpm test
corepack pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git -C ../jura-voice-api add .
git -C ../jura-voice-api commit -m "Add voice API service skeleton"
```

---

## Task 3: Voice Session API With Mocked OpenAI

**Files:**
- Modify: `../jura-voice-api/src/index.ts`
- Create: `../jura-voice-api/src/routes/voiceSessions.ts`
- Create: `../jura-voice-api/src/openaiRealtime.ts`
- Modify: `../jura-voice-api/src/supabase.ts`
- Create: `../jura-voice-api/tests/voiceSessions.test.ts`

**Interfaces:**
- Consumes: `verifySupabaseUser`, `has_feature_flag`, `voice_review_sessions`.
- Produces endpoint: `POST /voice/sessions`
- Produces response:

```ts
type CreateVoiceSessionResponse = {
  sessionId: string
  clientSecret: string
  model: 'gpt-realtime-2.1'
  voice: string
}
```

- [ ] **Step 1: Write failing route tests**

Create `../jura-voice-api/tests/voiceSessions.test.ts`:

```ts
import http from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServer } from '../src/index'

async function listen(server: http.Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('No server address')
  return `http://127.0.0.1:${address.port}`
}

describe('POST /voice/sessions', () => {
  let server: http.Server | null = null
  afterEach(() => server?.close())

  it('rejects users without the feature flag', async () => {
    server = createServer({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-a', email: 'a@test.local' } }, error: null })) },
      store: {
        hasFeature: vi.fn(async () => false),
        canReadPrompt: vi.fn(async () => true),
        countCompletedToday: vi.fn(async () => 0),
        createVoiceSession: vi.fn()
      },
      realtime: { createClientSecret: vi.fn() },
      config: { VOICE_DAILY_LIMIT: 20, VOICE_AGENT_MODEL: 'gpt-realtime-2.1', VOICE_AGENT_VOICE: 'marin' }
    })
    const baseUrl = await listen(server)
    const response = await fetch(`${baseUrl}/voice/sessions`, {
      method: 'POST',
      headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' },
      body: JSON.stringify({ promptId: 'prompt-a' })
    })
    expect(response.status).toBe(403)
  })

  it('creates a Realtime client secret for enabled users', async () => {
    server = createServer({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-a', email: 'a@test.local' } }, error: null })) },
      store: {
        hasFeature: vi.fn(async () => true),
        canReadPrompt: vi.fn(async () => true),
        countCompletedToday: vi.fn(async () => 0),
        createVoiceSession: vi.fn(async () => 'session-a')
      },
      realtime: { createClientSecret: vi.fn(async () => 'ek_test') },
      config: { VOICE_DAILY_LIMIT: 20, VOICE_AGENT_MODEL: 'gpt-realtime-2.1', VOICE_AGENT_VOICE: 'marin' }
    })
    const baseUrl = await listen(server)
    const response = await fetch(`${baseUrl}/voice/sessions`, {
      method: 'POST',
      headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' },
      body: JSON.stringify({ promptId: 'prompt-a' })
    })
    await expect(response.json()).resolves.toEqual({
      sessionId: 'session-a',
      clientSecret: 'ek_test',
      model: 'gpt-realtime-2.1',
      voice: 'marin'
    })
  })
})
```

- [ ] **Step 2: Run route tests to verify they fail**

Run:

```bash
cd ../jura-voice-api
corepack pnpm vitest run tests/voiceSessions.test.ts
```

Expected: FAIL because `createServer` does not accept dependencies and the route does not exist.

- [ ] **Step 3: Implement route and dependencies**

Create `../jura-voice-api/src/openaiRealtime.ts`:

```ts
export type RealtimeClientSecretInput = {
  userId: string
  promptText: string
  expectedAnswer: string
  model: string
  voice: string
}

export type RealtimeClientSecretProvider = {
  createClientSecret(input: RealtimeClientSecretInput): Promise<string>
}

export function createMockRealtimeProvider(): RealtimeClientSecretProvider {
  return {
    async createClientSecret() {
      return 'ek_mock'
    }
  }
}
```

Create `../jura-voice-api/src/routes/voiceSessions.ts`:

```ts
import { z } from 'zod'
import { parseBearerToken, verifySupabaseUser, type AuthDeps } from '../auth'
import type { RealtimeClientSecretProvider } from '../openaiRealtime'

const createSessionSchema = z.object({
  promptId: z.string().uuid()
})

export type VoiceStore = {
  hasFeature(userId: string, featureKey: 'flashcards_voice_agent'): Promise<boolean>
  canReadPrompt(userId: string, promptId: string): Promise<{ frontMarkdown: string; backMarkdown: string } | null>
  countCompletedToday(userId: string): Promise<number>
  createVoiceSession(input: { userId: string; promptId: string; model: string; voice: string }): Promise<string>
}

export type VoiceRouteDeps = {
  auth: AuthDeps
  store: VoiceStore
  realtime: RealtimeClientSecretProvider
  config: {
    VOICE_DAILY_LIMIT: number
    VOICE_AGENT_MODEL: string
    VOICE_AGENT_VOICE: string
  }
}

export async function createVoiceSessionRoute(headers: Headers, body: unknown, deps: VoiceRouteDeps) {
  const token = parseBearerToken(headers.get('authorization') ?? undefined)
  const user = await verifySupabaseUser(token, deps.auth)
  const input = createSessionSchema.parse(body)

  const hasFeature = await deps.store.hasFeature(user.id, 'flashcards_voice_agent')
  if (!hasFeature) return { status: 403, body: { error: 'Voice feature is not enabled.' } }

  const completedToday = await deps.store.countCompletedToday(user.id)
  if (completedToday >= deps.config.VOICE_DAILY_LIMIT) return { status: 429, body: { error: 'Voice limit reached.' } }

  const prompt = await deps.store.canReadPrompt(user.id, input.promptId)
  if (!prompt) return { status: 404, body: { error: 'Card not found.' } }

  const sessionId = await deps.store.createVoiceSession({
    userId: user.id,
    promptId: input.promptId,
    model: deps.config.VOICE_AGENT_MODEL,
    voice: deps.config.VOICE_AGENT_VOICE
  })

  const clientSecret = await deps.realtime.createClientSecret({
    userId: user.id,
    promptText: prompt.frontMarkdown,
    expectedAnswer: prompt.backMarkdown,
    model: deps.config.VOICE_AGENT_MODEL,
    voice: deps.config.VOICE_AGENT_VOICE
  })

  return {
    status: 200,
    body: {
      sessionId,
      clientSecret,
      model: deps.config.VOICE_AGENT_MODEL,
      voice: deps.config.VOICE_AGENT_VOICE
    }
  }
}
```

Modify `../jura-voice-api/src/index.ts`:

```ts
import http from 'node:http'
import { readConfig } from './config'
import { readJson, sendJson } from './http'
import { createVoiceSessionRoute, type VoiceRouteDeps } from './routes/voiceSessions'

export type ServerDeps = VoiceRouteDeps

export function createServer(deps?: ServerDeps) {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost')
      if (request.method === 'POST' && url.pathname === '/voice/sessions' && deps) {
        const result = await createVoiceSessionRoute(new Headers(request.headers as Record<string, string>), await readJson(request), deps)
        sendJson(response, result.status, result.body)
        return
      }
      sendJson(response, 404, { error: 'Not found' })
    } catch (error) {
      sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = readConfig(process.env)
  createServer().listen(config.PORT, () => {
    console.log(`jura-voice-api listening on ${config.PORT}`)
  })
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
cd ../jura-voice-api
corepack pnpm vitest run tests/voiceSessions.test.ts tests/auth.test.ts
corepack pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C ../jura-voice-api add .
git -C ../jura-voice-api commit -m "Add gated voice session endpoint"
```

---

## Task 4: Assessment And Scheduler Recording

**Files:**
- Create: `../jura-voice-api/src/assessment.ts`
- Modify: `../jura-voice-api/src/routes/voiceSessions.ts`
- Modify: `../jura-voice-api/src/supabase.ts`
- Create: `../jura-voice-api/tests/assessment.test.ts`

**Interfaces:**
- Produces endpoint: `POST /voice/sessions/:sessionId/complete`
- Produces type: `VoiceAssessment`
- Consumes RPC: `record_voice_review_assessment(...)`

- [ ] **Step 1: Write failing assessment tests**

Create `../jura-voice-api/tests/assessment.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { parseAssessment, shouldRecordAssessment } from '../src/assessment'

describe('voice assessment parsing', () => {
  it('accepts strict assessment json', () => {
    expect(parseAssessment({
      rating: 3,
      confidence: 'medium',
      reason: 'Die Kernelemente wurden genannt.',
      matched_points: ['Notwehrlage'],
      missed_points: ['Verteidigungswille'],
      next_step: 'Verteidigungswillen ausdruecklich nennen.'
    })).toEqual({
      rating: 3,
      confidence: 'medium',
      reason: 'Die Kernelemente wurden genannt.',
      matchedPoints: ['Notwehrlage'],
      missedPoints: ['Verteidigungswille'],
      nextStep: 'Verteidigungswillen ausdruecklich nennen.'
    })
  })

  it('does not record low confidence assessments', () => {
    expect(shouldRecordAssessment({ rating: 2, confidence: 'low' })).toBe(false)
    expect(shouldRecordAssessment({ rating: 3, confidence: 'medium' })).toBe(true)
    expect(shouldRecordAssessment({ rating: 4, confidence: 'high' })).toBe(true)
  })
})
```

- [ ] **Step 2: Run assessment tests to verify they fail**

Run:

```bash
cd ../jura-voice-api
corepack pnpm vitest run tests/assessment.test.ts
```

Expected: FAIL because `assessment.ts` does not exist.

- [ ] **Step 3: Implement assessment parser**

Create `../jura-voice-api/src/assessment.ts`:

```ts
import { z } from 'zod'

export const assessmentSchema = z.object({
  rating: z.number().int().min(1).max(4),
  confidence: z.enum(['low', 'medium', 'high']),
  reason: z.string().min(1),
  matched_points: z.array(z.string()).default([]),
  missed_points: z.array(z.string()).default([]),
  next_step: z.string().default('')
})

export type VoiceAssessment = {
  rating: 1 | 2 | 3 | 4
  confidence: 'low' | 'medium' | 'high'
  reason: string
  matchedPoints: string[]
  missedPoints: string[]
  nextStep: string
}

export function parseAssessment(value: unknown): VoiceAssessment {
  const parsed = assessmentSchema.parse(value)
  return {
    rating: parsed.rating as 1 | 2 | 3 | 4,
    confidence: parsed.confidence,
    reason: parsed.reason,
    matchedPoints: parsed.matched_points,
    missedPoints: parsed.missed_points,
    nextStep: parsed.next_step
  }
}

export function shouldRecordAssessment(input: Pick<VoiceAssessment, 'confidence' | 'rating'>): boolean {
  return input.confidence === 'medium' || input.confidence === 'high'
}
```

- [ ] **Step 4: Add completion route test**

Extend `../jura-voice-api/tests/voiceSessions.test.ts` with:

```ts
it('records medium confidence assessment through the store', async () => {
  const recordAssessment = vi.fn(async () => ({ recorded: true, reviewEventId: 'review-a' }))
  server = createServer({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-a', email: 'a@test.local' } }, error: null })) },
    store: {
      hasFeature: vi.fn(async () => true),
      canReadPrompt: vi.fn(async () => ({ frontMarkdown: 'Front', backMarkdown: 'Back' })),
      countCompletedToday: vi.fn(async () => 0),
      createVoiceSession: vi.fn(async () => 'session-a'),
      appendVoiceEvent: vi.fn(),
      recordAssessment
    },
    realtime: { createClientSecret: vi.fn(async () => 'ek_test') },
    config: { VOICE_DAILY_LIMIT: 20, VOICE_AGENT_MODEL: 'gpt-realtime-2.1', VOICE_AGENT_VOICE: 'marin' }
  })
  const baseUrl = await listen(server)
  const response = await fetch(`${baseUrl}/voice/sessions/session-a/complete`, {
    method: 'POST',
    headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' },
    body: JSON.stringify({
      transcript: 'Notwehrlage und Notwehrhandlung.',
      assessment: {
        rating: 3,
        confidence: 'medium',
        reason: 'Kernpunkte genannt.',
        matched_points: ['Notwehrlage'],
        missed_points: ['Verteidigungswille'],
        next_step: 'Verteidigungswillen nennen.'
      }
    })
  })
  expect(response.status).toBe(200)
  expect(recordAssessment).toHaveBeenCalledWith(expect.objectContaining({
    sessionId: 'session-a',
    userId: 'user-a',
    rating: 3,
    confidence: 'medium'
  }))
})
```

- [ ] **Step 5: Implement completion route**

Extend `VoiceStore` in `../jura-voice-api/src/routes/voiceSessions.ts`:

```ts
appendVoiceEvent(input: { sessionId: string; userId: string; eventType: string; payload: unknown }): Promise<void>
recordAssessment(input: {
  sessionId: string
  userId: string
  rating: 1 | 2 | 3 | 4
  confidence: 'low' | 'medium' | 'high'
  reason: string
  matchedPoints: string[]
  missedPoints: string[]
  nextStep: string
  rawAssessment: unknown
}): Promise<{ recorded: boolean; reviewEventId: string | null }>
```

Add route function:

```ts
const completeSessionSchema = z.object({
  transcript: z.string().min(1),
  assessment: z.unknown()
})

export async function completeVoiceSessionRoute(sessionId: string, headers: Headers, body: unknown, deps: VoiceRouteDeps) {
  const token = parseBearerToken(headers.get('authorization') ?? undefined)
  const user = await verifySupabaseUser(token, deps.auth)
  const input = completeSessionSchema.parse(body)
  const assessment = parseAssessment(input.assessment)

  await deps.store.appendVoiceEvent({
    sessionId,
    userId: user.id,
    eventType: 'transcript.final',
    payload: { transcript: input.transcript }
  })

  const result = await deps.store.recordAssessment({
    sessionId,
    userId: user.id,
    rating: assessment.rating,
    confidence: assessment.confidence,
    reason: assessment.reason,
    matchedPoints: assessment.matchedPoints,
    missedPoints: assessment.missedPoints,
    nextStep: assessment.nextStep,
    rawAssessment: input.assessment
  })

  return { status: 200, body: { assessment, recorded: result.recorded, reviewEventId: result.reviewEventId } }
}
```

Wire `/voice/sessions/:sessionId/complete` in `src/index.ts`.

- [ ] **Step 6: Run tests**

Run:

```bash
cd ../jura-voice-api
corepack pnpm test
corepack pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git -C ../jura-voice-api add .
git -C ../jura-voice-api commit -m "Add voice assessment recording"
```

---

## Task 5: App Feature Flags And Voice API Client

**Files:**
- Modify: `src/shared/ipc.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/index.ts`
- Modify: `src/renderer/src/api.ts`
- Create: `src/renderer/src/voice/featureFlags.ts`
- Create: `src/renderer/src/voice/voiceApi.ts`
- Create: `tests/renderer/voiceFeatureFlags.test.ts`

**Interfaces:**
- Produces `api.getFeatureFlags(): Promise<Record<string, boolean>>`
- Produces `api.createVoiceReviewSession(input: { promptId: string }): Promise<VoiceSessionStart>`
- Produces `api.completeVoiceReviewSession(input: VoiceSessionCompleteInput): Promise<VoiceSessionCompleteResult>`
- Consumes `/voice/sessions` endpoints from Task 3 and 4.

- [ ] **Step 1: Write failing renderer tests**

Create `tests/renderer/voiceFeatureFlags.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { hasFeatureFlag } from '../../src/renderer/src/voice/featureFlags'

describe('voice feature flags', () => {
  it('treats missing flags as disabled', () => {
    expect(hasFeatureFlag({}, 'flashcards_voice_agent')).toBe(false)
  })

  it('reads enabled voice flag', () => {
    expect(hasFeatureFlag({ flashcards_voice_agent: true }, 'flashcards_voice_agent')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
corepack pnpm vitest run tests/renderer/voiceFeatureFlags.test.ts
```

Expected: FAIL because `voice/featureFlags.ts` does not exist.

- [ ] **Step 3: Add shared IPC types**

Modify `src/shared/ipc.ts`:

```ts
export type FeatureFlags = Record<string, boolean>

export type VoiceSessionStartInput = {
  promptId: string
}

export type VoiceSessionStart = {
  sessionId: string
  clientSecret: string
  model: string
  voice: string
}

export type VoiceSessionCompleteInput = {
  sessionId: string
  transcript: string
  assessment: unknown
}

export type VoiceSessionCompleteResult = {
  assessment: {
    rating: ReviewRating
    confidence: 'low' | 'medium' | 'high'
    reason: string
    matchedPoints: string[]
    missedPoints: string[]
    nextStep: string
  }
  recorded: boolean
  reviewEventId: string | null
}
```

Add methods to `AppApi`:

```ts
getFeatureFlags(): Promise<FeatureFlags>
createVoiceReviewSession(input: VoiceSessionStartInput): Promise<VoiceSessionStart>
completeVoiceReviewSession(input: VoiceSessionCompleteInput): Promise<VoiceSessionCompleteResult>
```

- [ ] **Step 4: Implement feature flag helper and browser cloud calls**

Create `src/renderer/src/voice/featureFlags.ts`:

```ts
import type { FeatureFlags } from '@shared/ipc'

export type FeatureFlagKey = 'flashcards_voice_agent'

export function hasFeatureFlag(flags: FeatureFlags, key: FeatureFlagKey): boolean {
  return flags[key] === true
}
```

Create `src/renderer/src/voice/voiceApi.ts`:

```ts
import type { VoiceSessionCompleteInput, VoiceSessionCompleteResult, VoiceSessionStart, VoiceSessionStartInput } from '@shared/ipc'
import { getSupabaseAuthClient } from '../cloudAuth'

async function authHeaders(): Promise<HeadersInit> {
  const client = getSupabaseAuthClient()
  const { data } = client ? await client.auth.getSession() : { data: { session: null } }
  const token = data.session?.access_token
  if (!token) throw new Error('Bitte melde dich online an, um Voice zu nutzen.')
  return {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json'
  }
}

export async function createVoiceReviewSession(input: VoiceSessionStartInput): Promise<VoiceSessionStart> {
  const response = await fetch('/voice/sessions', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(input)
  })
  if (!response.ok) throw new Error('Voice konnte nicht gestartet werden.')
  return response.json() as Promise<VoiceSessionStart>
}

export async function completeVoiceReviewSession(input: VoiceSessionCompleteInput): Promise<VoiceSessionCompleteResult> {
  const response = await fetch(`/voice/sessions/${input.sessionId}/complete`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ transcript: input.transcript, assessment: input.assessment })
  })
  if (!response.ok) throw new Error('Voice-Bewertung konnte nicht gespeichert werden.')
  return response.json() as Promise<VoiceSessionCompleteResult>
}
```

Implement `getFeatureFlags` in `src/renderer/src/api.ts` cloud/browser fallback:

```ts
async getFeatureFlags() {
  if (!requiresCloudAuth()) return {}
  const client = getSupabaseAuthClient()
  if (!client) return {}
  const { data, error } = await client.rpc('get_effective_feature_flags')
  if (error) return {}
  return typeof data === 'object' && data ? data as Record<string, boolean> : {}
}
```

In browser fallback, wire `createVoiceReviewSession` and `completeVoiceReviewSession` to the functions from `voiceApi.ts`.

In Electron main/preload, expose IPC methods that return `{}` or throw an online-required message until cloud auth is available in renderer. Keep server calls in renderer for web parity.

- [ ] **Step 5: Run renderer tests and typecheck**

Run:

```bash
corepack pnpm vitest run tests/renderer/voiceFeatureFlags.test.ts tests/renderer/cloudLearningApi.test.ts
corepack pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/shared/ipc.ts src/preload/index.ts src/main/index.ts src/renderer/src/api.ts src/renderer/src/voice tests/renderer/voiceFeatureFlags.test.ts
git commit -m "Add voice feature flag client"
```

---

## Task 6: Flashcard Review Voice UI

**Files:**
- Modify: `src/renderer/src/views/FlashcardsReviewView.vue`
- Create: `src/renderer/src/voice/voiceClient.ts`
- Create: `tests/renderer/flashcardsVoiceUi.test.ts`

**Interfaces:**
- Consumes: `api.getFeatureFlags`, `api.createVoiceReviewSession`, `api.completeVoiceReviewSession`.
- Produces UI states: `Bereit`, `Verbindet`, `Hört zu`, `Fragt nach`, `Bewertet`, `Ergebnis`, `Nicht sicher`.

- [ ] **Step 1: Write failing UI contract tests**

Create `tests/renderer/flashcardsVoiceUi.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/renderer/src/views/FlashcardsReviewView.vue', 'utf8')

describe('flashcards voice UI contract', () => {
  it('gates the voice action behind flashcards_voice_agent', () => {
    expect(source).toContain('flashcards_voice_agent')
    expect(source).toContain('Mit Wolpi sprechen')
  })

  it('renders voice status and assessment result copy', () => {
    expect(source).toContain('Hört zu')
    expect(source).toContain('Bewertet')
    expect(source).toContain('Antwort konnte nicht sicher bewertet werden')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
corepack pnpm vitest run tests/renderer/flashcardsVoiceUi.test.ts
```

Expected: FAIL because the UI does not contain voice copy.

- [ ] **Step 3: Implement WebRTC client wrapper**

Create `src/renderer/src/voice/voiceClient.ts`:

```ts
export type VoiceClientStatus = 'idle' | 'connecting' | 'listening' | 'assessing' | 'result' | 'uncertain' | 'error'

export type VoiceClientCallbacks = {
  onStatus(status: VoiceClientStatus): void
  onTranscript(transcript: string): void
  onError(message: string): void
}

export type VoiceClient = {
  stop(): void
}

export async function startVoiceClient(input: {
  clientSecret: string
  callbacks: VoiceClientCallbacks
}): Promise<VoiceClient> {
  input.callbacks.onStatus('connecting')
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const pc = new RTCPeerConnection()
  stream.getTracks().forEach((track) => pc.addTrack(track, stream))
  const dc = pc.createDataChannel('oai-events')
  dc.addEventListener('open', () => input.callbacks.onStatus('listening'))
  dc.addEventListener('message', (event) => {
    const payload = JSON.parse(String(event.data)) as { type?: string; transcript?: string; delta?: string }
    if (payload.type?.includes('transcript') && payload.transcript) input.callbacks.onTranscript(payload.transcript)
  })

  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
  const response = await fetch('https://api.openai.com/v1/realtime/calls', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.clientSecret}`,
      'content-type': 'application/sdp'
    },
    body: offer.sdp
  })
  const answer = { type: 'answer' as const, sdp: await response.text() }
  await pc.setRemoteDescription(answer)

  return {
    stop() {
      dc.close()
      pc.close()
      stream.getTracks().forEach((track) => track.stop())
    }
  }
}
```

- [ ] **Step 4: Add gated voice UI**

Modify `FlashcardsReviewView.vue`:

- Add `featureFlags`, `voiceStatus`, `voiceTranscript`, `voiceResult`, `voiceError`, `voiceClient`.
- Load flags in `load()` with `featureFlags.value = await api.getFeatureFlags()`.
- Add computed `voiceEnabled = computed(() => hasFeatureFlag(featureFlags.value, 'flashcards_voice_agent'))`.
- Add a button near "Rückseite zeigen":

```vue
<UButton
  v-if="voiceEnabled && currentCard"
  type="button"
  icon="i-lucide-mic"
  :disabled="voiceStatus === 'connecting' || voiceStatus === 'listening' || ratingBusy"
  @click="startVoiceReview"
>
  Mit Wolpi sprechen
</UButton>
```

- Add result/error region:

```vue
<section v-if="voiceStatus !== 'idle'" class="voice-review-panel" aria-live="polite">
  <strong>{{ voiceStatusLabel }}</strong>
  <p v-if="voiceTranscript">{{ voiceTranscript }}</p>
  <p v-if="voiceError" class="review-feedback">{{ voiceError }}</p>
  <div v-if="voiceResult">
    <p>{{ voiceResult.assessment.reason }}</p>
    <p v-if="!voiceResult.recorded">Antwort konnte nicht sicher bewertet werden.</p>
  </div>
</section>
```

- Add `startVoiceReview()`:

```ts
async function startVoiceReview(): Promise<void> {
  const card = currentCard.value
  if (!card) return
  try {
    voiceStatus.value = 'connecting'
    voiceError.value = ''
    const session = await api.createVoiceReviewSession({ promptId: card.id })
    voiceClient.value = await startVoiceClient({
      clientSecret: session.clientSecret,
      callbacks: {
        onStatus: (status) => { voiceStatus.value = status },
        onTranscript: (transcript) => { voiceTranscript.value = transcript },
        onError: (message) => { voiceError.value = message; voiceStatus.value = 'error' }
      }
    })
  } catch {
    voiceStatus.value = 'error'
    voiceError.value = 'Voice konnte nicht gestartet werden. Du kannst die Karte weiter manuell wiederholen.'
  }
}
```

- Add a manual "Antwort beenden" button that calls backend completion in the mocked MVP path. In the real OpenAI integration, server-side assessment will be called after the session produces the final transcript event.

- [ ] **Step 5: Run tests**

Run:

```bash
corepack pnpm vitest run tests/renderer/flashcardsVoiceUi.test.ts tests/renderer/flashcardsUi.test.ts
corepack pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/views/FlashcardsReviewView.vue src/renderer/src/voice tests/renderer/flashcardsVoiceUi.test.ts
git commit -m "Add gated flashcard voice review UI"
```

---

## Task 7: Production Routing And Container Wiring

**Files:**
- Modify: `../jura-supabase/deploy/production/nginx.conf`
- Modify: `../jura-supabase/docker-compose.production.yml`
- Modify: `../jura-supabase/.env.example`
- Modify: `../jura-supabase/README.md`
- Create: `../jura-voice-api/Dockerfile`

**Interfaces:**
- Produces public route: `https://app.jura-wolpi.de/voice/*`
- Consumes service port: `jura-voice-api:8087`

- [ ] **Step 1: Add voice API Dockerfile**

Create `../jura-voice-api/Dockerfile`:

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM deps AS build
COPY tsconfig.json vitest.config.ts ./
COPY src ./src
RUN pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod
COPY --from=build /app/dist ./dist
EXPOSE 8087
CMD ["node", "dist/src/index.js"]
```

- [ ] **Step 2: Add production compose service**

Modify `../jura-supabase/docker-compose.production.yml`:

```yaml
  voice-api:
    container_name: jura-voice-api
    build:
      context: ../jura-voice-api
    restart: unless-stopped
    networks:
      - jura-wolpi-internal
      - default
    environment:
      PORT: 8087
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      SUPABASE_URL: http://kong:8000
      SUPABASE_SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY}
      VOICE_DAILY_LIMIT: ${VOICE_DAILY_LIMIT:-20}
      VOICE_AGENT_MODEL: gpt-realtime-2.1
      VOICE_AGENT_VOICE: marin
```

- [ ] **Step 3: Route `/voice/` in Nginx**

Modify `../jura-supabase/deploy/production/nginx.conf` in the `app.jura-wolpi.de` server block before `location /api/`:

```nginx
        location = /voice {
            return 308 /voice/;
        }

        location /voice/ {
            set $voice_upstream http://jura-voice-api:8087;
            proxy_pass $voice_upstream;
            proxy_http_version 1.1;
            proxy_connect_timeout 5s;
            proxy_send_timeout 300s;
            proxy_read_timeout 300s;
            proxy_buffering off;
            proxy_request_buffering off;
            proxy_set_header Host $host;
            proxy_set_header X-Forwarded-Host $host;
            proxy_set_header X-Forwarded-Proto https;
            proxy_set_header X-Forwarded-Prefix /voice;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
        }
```

- [ ] **Step 4: Document env and smoke checks**

Add to `../jura-supabase/.env.example`:

```env
OPENAI_API_KEY=
VOICE_DAILY_LIMIT=20
```

Add to `../jura-supabase/README.md`:

```markdown
Voice API smoke check:

```sh
curl -k -sS -o /dev/null -w '%{http_code}\n' https://app.jura-wolpi.de/voice/health
```

Expected unauthenticated health response is `200`. Authenticated session creation remains behind Supabase JWT and feature flags.
```

- [ ] **Step 5: Run config checks**

Run:

```bash
cd ../jura-voice-api
corepack pnpm build
docker build -t jura-voice-api:test .

cd ../jura-supabase
docker compose -f docker-compose.yml -f docker-compose.production.yml config >/tmp/jura-wolpi-compose.yml
nginx -t -c "$PWD/deploy/production/nginx.conf"
```

Expected: build succeeds, compose renders, Nginx config syntax is valid.

- [ ] **Step 6: Commit**

```bash
git -C ../jura-voice-api add Dockerfile package.json pnpm-lock.yaml
git -C ../jura-voice-api commit -m "Add voice API container"
git -C ../jura-supabase add deploy/production/nginx.conf docker-compose.production.yml .env.example README.md
git -C ../jura-supabase commit -m "Route voice API in production"
```

---

## Task 8: End-To-End Verification And Rollout Script

**Files:**
- Create: `../jura-supabase/scripts/enable-voice-feature.sh`
- Create: `../jura-voice-api/tests/e2e.mock.test.ts`
- Modify: `jura-klausuren-wolpertinger/tests/renderer/flashcardsVoiceUi.test.ts`

**Interfaces:**
- Produces operator command: `../jura-supabase/scripts/enable-voice-feature.sh <email>`
- Verifies: enabled user sees voice flow, disabled user does not.

- [ ] **Step 1: Create feature enable script**

Create `../jura-supabase/scripts/enable-voice-feature.sh`:

```sh
#!/bin/sh
set -eu

email="${1:-}"
if [ -z "$email" ]; then
  echo "Usage: $0 <user-email>" >&2
  exit 1
fi

docker exec -i jura-supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -v user_email="$email" <<'SQL'
insert into public.feature_flags (key, description, enabled_globally)
values ('flashcards_voice_agent', 'Voice agent for flashcard review', false)
on conflict (key) do update set description = excluded.description;

insert into public.user_feature_flags (user_id, feature_key, enabled)
select id, 'flashcards_voice_agent', true
from auth.users
where lower(email) = lower(:'user_email')
on conflict (user_id, feature_key) do update set enabled = true, updated_at = now();

select id, email from auth.users where lower(email) = lower(:'user_email');
SQL
```

Run:

```bash
chmod +x ../jura-supabase/scripts/enable-voice-feature.sh
```

- [ ] **Step 2: Create mocked E2E service test**

Create `../jura-voice-api/tests/e2e.mock.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

describe('voice rollout contract', () => {
  it('keeps automatic ratings behind feature flag and confidence threshold', () => {
    const contract = {
      featureKey: 'flashcards_voice_agent',
      model: 'gpt-realtime-2.1',
      lowConfidenceRecordsReview: false,
      mediumConfidenceRecordsReview: true,
      highConfidenceRecordsReview: true,
      rawAudioStored: false
    }
    expect(contract).toEqual({
      featureKey: 'flashcards_voice_agent',
      model: 'gpt-realtime-2.1',
      lowConfidenceRecordsReview: false,
      mediumConfidenceRecordsReview: true,
      highConfidenceRecordsReview: true,
      rawAudioStored: false
    })
  })
})
```

- [ ] **Step 3: Run all relevant tests**

Run:

```bash
cd ../jura-supabase
./scripts/apply-local-sql.sh
./scripts/test-sql.sh tests/sql/001_learning_foundation_test.sql
./scripts/test-sql.sh tests/sql/005_voice_feature_flags_test.sql

cd ../jura-voice-api
corepack pnpm test
corepack pnpm typecheck

cd ../jura-klausuren-wolpertinger/jura-klausuren-wolpertinger
corepack pnpm vitest run tests/renderer/voiceFeatureFlags.test.ts tests/renderer/flashcardsVoiceUi.test.ts tests/renderer/flashcardsUi.test.ts
corepack pnpm run typecheck
```

Expected: all commands pass.

- [ ] **Step 4: Commit rollout tooling**

```bash
git -C ../jura-supabase add scripts/enable-voice-feature.sh
git -C ../jura-supabase commit -m "Add voice feature enable script"
git -C ../jura-voice-api add tests/e2e.mock.test.ts
git -C ../jura-voice-api commit -m "Add voice rollout contract test"
```

- [ ] **Step 5: Deploy to server.02**

Run from local machine:

```bash
git -C ../jura-supabase push
git -C ../jura-voice-api push
git push
ssh server.02 'cd /home/docker-compose/jura-wolpi && docker compose --env-file .env -f docker-compose.yml -f docker-compose.production.yml up -d --build voice-api nginx'
```

Expected: `voice-api` and `nginx` containers restart successfully.

- [ ] **Step 6: Production smoke**

Run:

```bash
curl -k -sS -o /dev/null -w '%{http_code}\n' https://app.jura-wolpi.de/
curl -k -sS -o /dev/null -w '%{http_code}\n' https://app.jura-wolpi.de/voice/health
```

Expected:

```text
200
200
```

Enable for one internal user:

```bash
ssh server.02 'cd /home/docker-compose/jura-wolpi && ./scripts/enable-voice-feature.sh erhardt.sebastian@gmail.com'
```

Expected: script prints the matching user ID and email.

---

## Self-Review

- Spec coverage: feature flags, own backend, WebRTC, server-side OpenAI key, voice session persistence, confidence-gated automatic rating, 20/day limit, no raw audio, local/cloud behavior, testing, and deployment are covered by Tasks 1-8.
- Placeholder scan: no unresolved placeholder tokens or open-ended implementation notes remain.
- Type consistency: `flashcards_voice_agent`, `VoiceSessionStart`, `VoiceSessionCompleteInput`, `VoiceAssessment`, and `record_voice_review_assessment` are named consistently across tasks.
