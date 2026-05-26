# AI Training Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an MVP where users can add exam source metadata and upload roles, store an OpenAI API key, generate a KI-Korrekturvorschlag for a submitted exam, review/accept it into the existing correction structure, and track derived learning tasks.

**Architecture:** Keep Renderer isolated from SQLite, filesystem, API keys, and cloud calls. Shared schemas define the contract; Preload/IPC expose typed methods; Main services own persistence, prompt construction, OpenAI Responses API calls, Zod validation, and conversion of accepted AI drafts into `corrections`, `inline_comments`, and learning tasks.

**Tech Stack:** Electron, Vue 3, TypeScript, Pinia-style local API wrapper, SQLite via `better-sqlite3`, Zod, native `fetch` in Main, OpenAI Responses API with structured JSON output and PDF file input support.

---

## Scope Decision

The approved design covers several subsystems. This plan implements one vertical MVP, not the full long-term product:

- In scope: metadata, attachment roles, OpenAI key settings, AI correction draft generation, review/accept/reject, learning tasks, analytics summary.
- Out of scope: provider-operated accounts, local models, full weekly learning calendar, bundled third-party Klausuren, streaming UI, automatic OCR beyond OpenAI file input.

## File Structure

- Modify `src/shared/constants.ts`: bump `DATABASE_SCHEMA_VERSION`.
- Modify `src/shared/schemas.ts`: add exam metadata, attachment role, AI settings status, AI correction draft, learning task, and schema validation.
- Modify `src/shared/ipc.ts`: add typed inputs/DTOs for AI settings, AI drafts, accepting drafts, and learning tasks.
- Modify `src/preload/index.ts`: expose new IPC methods.
- Modify `src/main/index.ts`: register new IPC handlers and pass dialog role input to attachment import.
- Modify `src/main/services/database.ts`: create schema v3 and migrate v2 to v3.
- Modify `src/main/services/services.ts`: persist metadata, attachment roles, AI settings, AI drafts, learning tasks; implement draft acceptance.
- Create `src/main/services/aiCorrection.ts`: prompt construction, document conversion, OpenAI request, schema parsing.
- Modify `src/renderer/src/api.ts`: keep typed `window.juraApi` usage intact.
- Modify `src/renderer/src/views/ExamView.vue`: add metadata fields and upload role picker.
- Modify `src/renderer/src/views/CorrectionView.vue`: add AI correction panel and review actions.
- Modify `src/renderer/src/views/AnalyticsView.vue`: add learning-task/error category summary.
- Modify `src/renderer/src/views/HelpView.vue`: explain AI correction privacy and API key setup.
- Modify `docs/user-stories.md`: add AI correction and learning-task stories.
- Modify tests in `tests/shared/schemas.test.ts`, `tests/main/services.test.ts`, and add `tests/main/aiCorrection.test.ts`.

## Task 1: Shared Domain Types and Schema Version

**Files:**
- Modify: `src/shared/constants.ts`
- Modify: `src/shared/schemas.ts`
- Modify: `tests/shared/schemas.test.ts`

- [ ] **Step 1: Write failing schema tests**

Add tests to `tests/shared/schemas.test.ts`:

```ts
import {
  aiCorrectionDraftSchema,
  attachmentSchema,
  examListItemSchema,
  learningTaskSchema
} from '@shared/schemas'

it('validates exam metadata and attachment roles', () => {
  expect(
    examListItemSchema.parse({
      id: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      title: 'ZR Urteil',
      folderId: null,
      folderName: null,
      status: 'draft',
      tags: ['zivilrecht'],
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
      currentRevisionId: null,
      latestScore: null,
      legalArea: 'civil',
      examType: 'judgment',
      sourceName: 'Hemmer',
      sourceUrl: 'https://example.test/klausur'
    }).legalArea
  ).toBe('civil')

  expect(
    attachmentSchema.parse({
      schemaVersion: 1,
      id: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      examId: crypto.randomUUID(),
      originalName: 'musterloesung.pdf',
      storedName: 'stored.pdf',
      mimeType: 'application/pdf',
      size: 12,
      relativePath: 'exams/x/attachments/y/stored.pdf',
      role: 'model_solution',
      createdAt: new Date().toISOString()
    }).role
  ).toBe('model_solution')
})

it('validates AI correction drafts and learning tasks', () => {
  const userId = crypto.randomUUID()
  const submissionId = crypto.randomUUID()
  const draft = aiCorrectionDraftSchema.parse({
    schemaVersion: 1,
    id: crypto.randomUUID(),
    userId,
    submissionId,
    correctionId: null,
    status: 'draft',
    provider: 'openai',
    model: 'gpt-5',
    promptVersion: 'ai-correction-v1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    score: { system: 'bayern-0-18', points: 8.5 },
    scoreReasoning: 'Solide Grundstruktur, aber Schwerpunkt verfehlt.',
    gradingComment: 'Die Hauptprobleme wurden teilweise erkannt.',
    strengths: ['Gut lesbarer Aufbau'],
    weaknesses: ['Schwerpunktsetzung zu breit'],
    tags: ['schwerpunktsetzung'],
    confidence: 'medium',
    improvementSuggestions: [
      {
        category: 'structure',
        priority: 'high',
        title: 'Schwerpunkt frueher setzen',
        detail: 'Pruefe die zentrale Anspruchsgrundlage vor Nebenfragen.'
      }
    ],
    inlineComments: []
  })
  expect(draft.score.points).toBe(8.5)

  expect(
    learningTaskSchema.parse({
      schemaVersion: 1,
      id: crypto.randomUUID(),
      userId,
      submissionId,
      correctionId: null,
      aiDraftId: draft.id,
      category: 'structure',
      priority: 'high',
      status: 'open',
      title: 'Schwerpunkt frueher setzen',
      detail: 'Pruefe zentrale Anspruchsgrundlagen vor Nebenfragen.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).status
  ).toBe('open')
})
```

- [ ] **Step 2: Run schema tests and verify failure**

Run: `pnpm vitest run tests/shared/schemas.test.ts`

Expected: FAIL because `aiCorrectionDraftSchema`, `learningTaskSchema`, and metadata fields do not exist.

- [ ] **Step 3: Bump schema version**

In `src/shared/constants.ts`, change:

```ts
export const DATABASE_SCHEMA_VERSION = 3
```

- [ ] **Step 4: Add shared schemas**

In `src/shared/schemas.ts`, add:

```ts
export const legalAreaSchema = z.enum(['civil', 'criminal', 'public', 'mixed', 'other'])
export const examTypeSchema = z.enum([
  'judgment',
  'order',
  'relation',
  'indictment',
  'expert_opinion',
  'pleading',
  'other'
])
export const attachmentRoleSchema = z.enum(['assignment', 'candidate_note', 'model_solution', 'other'])
export const aiDraftStatusSchema = z.enum(['draft', 'accepted', 'rejected', 'superseded'])
export const aiConfidenceSchema = z.enum(['low', 'medium', 'high'])
export const improvementCategorySchema = z.enum([
  'issue_spotting',
  'law',
  'procedure',
  'structure',
  'argumentation',
  'style',
  'time_management',
  'other'
])
export const learningTaskStatusSchema = z.enum(['open', 'in_progress', 'done'])
export const learningTaskPrioritySchema = z.enum(['low', 'medium', 'high'])

export const improvementSuggestionSchema = z.object({
  category: improvementCategorySchema,
  priority: learningTaskPrioritySchema,
  title: z.string().min(1),
  detail: z.string().min(1)
})

export const aiInlineCommentSuggestionSchema = z.object({
  selectedText: z.string().min(1),
  prefix: z.string().default(''),
  suffix: z.string().default(''),
  body: z.string().min(1),
  tags: z.array(z.string()).default([])
})

export const aiCorrectionDraftSchema = z.object({
  schemaVersion: z.literal(1),
  id: uuidSchema,
  userId: uuidSchema,
  submissionId: uuidSchema,
  correctionId: uuidSchema.nullable(),
  status: aiDraftStatusSchema,
  provider: z.literal('openai'),
  model: z.string().min(1),
  promptVersion: z.literal('ai-correction-v1'),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  score: scoreSchema,
  scoreReasoning: z.string().min(1),
  gradingComment: z.string().min(1),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  tags: z.array(z.string()),
  confidence: aiConfidenceSchema,
  improvementSuggestions: z.array(improvementSuggestionSchema),
  inlineComments: z.array(aiInlineCommentSuggestionSchema)
})

export const learningTaskSchema = z.object({
  schemaVersion: z.literal(1),
  id: uuidSchema,
  userId: uuidSchema,
  submissionId: uuidSchema,
  correctionId: uuidSchema.nullable(),
  aiDraftId: uuidSchema.nullable(),
  category: improvementCategorySchema,
  priority: learningTaskPrioritySchema,
  status: learningTaskStatusSchema,
  title: z.string().min(1),
  detail: z.string().min(1),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema
})
```

Extend `examListItemSchema`:

```ts
legalArea: legalAreaSchema.nullable().default(null),
examType: examTypeSchema.nullable().default(null),
sourceName: z.string().nullable().default(null),
sourceUrl: z.string().nullable().default(null)
```

Extend `documentSchema` with the same four fields, and extend `attachmentSchema`:

```ts
role: attachmentRoleSchema.default('other')
```

Export inferred types:

```ts
export type LegalArea = z.infer<typeof legalAreaSchema>
export type ExamType = z.infer<typeof examTypeSchema>
export type AttachmentRole = z.infer<typeof attachmentRoleSchema>
export type AiCorrectionDraft = z.infer<typeof aiCorrectionDraftSchema>
export type LearningTask = z.infer<typeof learningTaskSchema>
export type ImprovementSuggestion = z.infer<typeof improvementSuggestionSchema>
```

- [ ] **Step 5: Run schema tests**

Run: `pnpm vitest run tests/shared/schemas.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/shared/constants.ts src/shared/schemas.ts tests/shared/schemas.test.ts
git commit -m "Add AI correction shared schemas"
```

## Task 2: Database Migration and Service Persistence

**Files:**
- Modify: `src/main/services/database.ts`
- Modify: `src/main/services/services.ts`
- Modify: `src/shared/ipc.ts`
- Modify: `tests/main/services.test.ts`

- [ ] **Step 1: Write failing service tests**

Add tests to `tests/main/services.test.ts`:

```ts
it('stores exam metadata and attachment roles', async () => {
  const exam = services.createExam({
    title: 'ZR Urteil',
    legalArea: 'civil',
    examType: 'judgment',
    sourceName: 'Hemmer',
    sourceUrl: 'https://example.test/klausur'
  })

  expect(exam.legalArea).toBe('civil')
  expect(exam.examType).toBe('judgment')
  expect(exam.sourceName).toBe('Hemmer')

  const sourcePath = join(dataDir, 'musterloesung.pdf')
  await writeFile(sourcePath, 'Musterloesung')
  const attachment = await services.addAttachmentFromPath(exam.id, sourcePath, 'model_solution')

  expect(attachment.role).toBe('model_solution')
  expect(services.getExam(exam.id).attachments[0].role).toBe('model_solution')
})

it('stores AI drafts and accepts them into the existing correction structure', () => {
  const exam = services.createExam({ title: 'KI Klausur', legalArea: 'civil', examType: 'judgment' })
  services.saveRevision(exam.id, {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Anspruch entstanden.' }] }]
  })
  const submission = services.submitExam(exam.id)
  const draft = services.saveAiCorrectionDraft({
    submissionId: submission.id,
    provider: 'openai',
    model: 'gpt-5',
    scorePoints: 7.5,
    scoreReasoning: 'Basis erkannt, Schwerpunkt fehlt.',
    gradingComment: 'Ordentliche Grundlage.',
    strengths: ['Anspruchsaufbau vorhanden'],
    weaknesses: ['Schwerpunktsetzung fehlt'],
    tags: ['schwerpunktsetzung'],
    confidence: 'medium',
    improvementSuggestions: [
      {
        category: 'structure',
        priority: 'high',
        title: 'Schwerpunkt setzen',
        detail: 'Beginne mit der zentralen Anspruchsgrundlage.'
      }
    ],
    inlineComments: []
  })

  const accepted = services.acceptAiCorrectionDraft(draft.id)
  const details = services.getSubmission(submission.id)
  const tasks = services.listLearningTasks()

  expect(accepted.status).toBe('accepted')
  expect(details.corrections[0].score.points).toBe(7.5)
  expect(details.corrections[0].gradingComment).toContain('Ordentliche Grundlage')
  expect(details.corrections[0].tags).toEqual(['schwerpunktsetzung'])
  expect(tasks).toEqual([
    expect.objectContaining({
      submissionId: submission.id,
      category: 'structure',
      priority: 'high',
      status: 'open'
    })
  ])
})
```

- [ ] **Step 2: Run service tests and verify failure**

Run: `pnpm vitest run tests/main/services.test.ts`

Expected: FAIL because schema v3 tables and service methods do not exist.

- [ ] **Step 3: Add v3 migration**

In `src/main/services/database.ts`, update `initializeDatabase`:

```ts
if (version === 1 && DATABASE_SCHEMA_VERSION === 3) {
  migrateV1ToV2(db)
  migrateV2ToV3(db)
  return
}

if (version === 2 && DATABASE_SCHEMA_VERSION === 3) {
  migrateV2ToV3(db)
  return
}
```

In `createSchema`, add columns to `exams`:

```sql
legal_area TEXT,
exam_type TEXT,
source_name TEXT,
source_url TEXT,
```

Add `role TEXT NOT NULL DEFAULT 'other'` to `attachments`.

Add tables:

```sql
CREATE TABLE ai_correction_drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  correction_id TEXT REFERENCES corrections(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  score_points REAL,
  score_reasoning TEXT NOT NULL,
  grading_comment TEXT NOT NULL,
  strengths_json TEXT NOT NULL,
  weaknesses_json TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  confidence TEXT NOT NULL,
  improvement_suggestions_json TEXT NOT NULL,
  inline_comments_json TEXT NOT NULL
);

CREATE TABLE learning_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  correction_id TEXT REFERENCES corrections(id) ON DELETE SET NULL,
  ai_draft_id TEXT REFERENCES ai_correction_drafts(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE ai_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  api_key TEXT NOT NULL,
  model TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_ai_correction_drafts_submission_id ON ai_correction_drafts(submission_id);
CREATE INDEX idx_learning_tasks_user_id ON learning_tasks(user_id);
```

Add:

```ts
function migrateV2ToV3(db: SqliteDatabase): void {
  const migratedAt = nowIso()
  db.transaction(() => {
    addColumnIfMissing(db, 'exams', 'legal_area TEXT')
    addColumnIfMissing(db, 'exams', 'exam_type TEXT')
    addColumnIfMissing(db, 'exams', 'source_name TEXT')
    addColumnIfMissing(db, 'exams', 'source_url TEXT')
    addColumnIfMissing(db, 'attachments', "role TEXT NOT NULL DEFAULT 'other'")
    db.exec(`
      CREATE TABLE IF NOT EXISTS ai_correction_drafts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
        correction_id TEXT REFERENCES corrections(id) ON DELETE SET NULL,
        status TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        prompt_version TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        score_points REAL,
        score_reasoning TEXT NOT NULL,
        grading_comment TEXT NOT NULL,
        strengths_json TEXT NOT NULL,
        weaknesses_json TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        confidence TEXT NOT NULL,
        improvement_suggestions_json TEXT NOT NULL,
        inline_comments_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS learning_tasks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
        correction_id TEXT REFERENCES corrections(id) ON DELETE SET NULL,
        ai_draft_id TEXT REFERENCES ai_correction_drafts(id) ON DELETE SET NULL,
        category TEXT NOT NULL,
        priority TEXT NOT NULL,
        status TEXT NOT NULL,
        title TEXT NOT NULL,
        detail TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ai_settings (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        api_key TEXT NOT NULL,
        model TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ai_correction_drafts_submission_id ON ai_correction_drafts(submission_id);
      CREATE INDEX IF NOT EXISTS idx_learning_tasks_user_id ON learning_tasks(user_id);
    `)
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('schema_version', '3')
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('last_migrated_at', migratedAt)
    updateAppVersion(db)
  })()
}

function addColumnIfMissing(db: SqliteDatabase, table: string, definition: string): void {
  const column = definition.split(/\s+/)[0]
  if (!columnExists(db, table, column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`)
}
```

- [ ] **Step 4: Extend IPC types**

In `src/shared/ipc.ts`, import new types and extend inputs:

```ts
import type { AiCorrectionDraft, AttachmentRole, ExamType, LearningTask, LegalArea } from './schemas'

export type CreateExamInput = {
  title: string
  folderId?: string | null
  tags?: string[]
  legalArea?: LegalArea | null
  examType?: ExamType | null
  sourceName?: string | null
  sourceUrl?: string | null
}

export type UpdateExamInput = CreateExamInput & { id: string; status?: ExamStatus; notes?: string }

export type SaveAiSettingsInput = {
  provider: 'openai'
  apiKey: string
  model: string
}

export type AiSettingsStatus = {
  provider: 'openai'
  configured: boolean
  model: string | null
  updatedAt: string | null
}

export type GenerateAiCorrectionInput = {
  submissionId: string
}

export type SaveAiCorrectionDraftInput = {
  submissionId: string
  provider: 'openai'
  model: string
  scorePoints: number | null
  scoreReasoning: string
  gradingComment: string
  strengths: string[]
  weaknesses: string[]
  tags: string[]
  confidence: 'low' | 'medium' | 'high'
  improvementSuggestions: Array<{
    category: string
    priority: string
    title: string
    detail: string
  }>
  inlineComments: Array<{
    selectedText: string
    prefix: string
    suffix: string
    body: string
    tags: string[]
  }>
}
```

Extend `AppApi`:

```ts
getAiSettingsStatus(): Promise<AiSettingsStatus>
saveAiSettings(input: SaveAiSettingsInput): Promise<AiSettingsStatus>
generateAiCorrectionDraft(input: GenerateAiCorrectionInput): Promise<AiCorrectionDraft>
listAiCorrectionDrafts(submissionId: string): Promise<AiCorrectionDraft[]>
acceptAiCorrectionDraft(draftId: string): Promise<AiCorrectionDraft>
rejectAiCorrectionDraft(draftId: string): Promise<AiCorrectionDraft>
listLearningTasks(): Promise<LearningTask[]>
updateLearningTaskStatus(taskId: string, status: 'open' | 'in_progress' | 'done'): Promise<LearningTask>
addAttachment(examId: string, role?: AttachmentRole): Promise<Attachment | null>
```

- [ ] **Step 5: Implement service persistence**

In `src/main/services/services.ts`, update `createExam`, `updateExam`, `examListItemFromRow`, `attachmentFromRow`, and `addAttachmentFromPath(examId, sourcePath, role = 'other')`.

Add methods:

```ts
saveAiCorrectionDraft(input: SaveAiCorrectionDraftInput): AiCorrectionDraft
listAiCorrectionDrafts(submissionId: string): AiCorrectionDraft[]
acceptAiCorrectionDraft(draftId: string): AiCorrectionDraft
rejectAiCorrectionDraft(draftId: string): AiCorrectionDraft
listLearningTasks(): LearningTask[]
updateLearningTaskStatus(taskId: string, status: LearningTask['status']): LearningTask
```

Acceptance rules:

```ts
const correction = this.createCorrection(draft.submissionId)
const updatedCorrection = this.updateCorrection({
  correctionId: correction.id,
  scorePoints: draft.score.points,
  gradingComment: draft.gradingComment,
  tags: draft.tags
})
const updatedAt = nowIso()
for (const suggestion of draft.improvementSuggestions) {
  this.db
    .prepare(
      `
      INSERT INTO learning_tasks
        (id, user_id, submission_id, correction_id, ai_draft_id, category, priority, status, title, detail, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
    .run(
      newId(),
      draft.userId,
      draft.submissionId,
      updatedCorrection.id,
      draft.id,
      suggestion.category,
      suggestion.priority,
      'open',
      suggestion.title,
      suggestion.detail,
      updatedAt,
      updatedAt
    )
}
this.db
  .prepare('UPDATE ai_correction_drafts SET status = ?, correction_id = ?, updated_at = ? WHERE id = ?')
  .run('accepted', updatedCorrection.id, updatedAt, draft.id)
this.db
  .prepare(
    `
    UPDATE ai_correction_drafts
    SET status = ?, updated_at = ?
    WHERE submission_id = ? AND id != ? AND status = ?
  `
  )
  .run('superseded', updatedAt, draft.submissionId, draft.id, 'draft')
```

For v1, do not auto-create inline comments from AI suggestions unless a reliable `selectedText` match is found in the rendered plain text. If no match exists, include the suggestion text in learning tasks or general feedback.

- [ ] **Step 6: Run tests**

Run: `pnpm vitest run tests/main/services.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/shared/ipc.ts src/main/services/database.ts src/main/services/services.ts tests/main/services.test.ts
git commit -m "Persist AI correction drafts and exam metadata"
```

## Task 3: AI Correction Service

**Files:**
- Create: `src/main/services/aiCorrection.ts`
- Modify: `src/main/services/services.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Test: `tests/main/aiCorrection.test.ts`

- [ ] **Step 1: Write failing AI service tests**

Create `tests/main/aiCorrection.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildAiCorrectionPrompt, parseAiCorrectionResponse } from '@main/services/aiCorrection'

describe('AI correction service', () => {
  it('builds a prompt with the legal grading rubric and submission context', () => {
    const prompt = buildAiCorrectionPrompt({
      examTitle: 'ZR Urteil',
      legalArea: 'civil',
      examType: 'judgment',
      sourceName: 'Hemmer',
      submissionText: 'Anspruch entstanden.',
      hasAssignment: true,
      hasModelSolution: true
    })

    expect(prompt).toContain('Bayern 0-18')
    expect(prompt).toContain('Hauptprobleme')
    expect(prompt).toContain('vertretbar')
    expect(prompt).toContain('Verbesserungsvorschlaege')
    expect(prompt).toContain('ZR Urteil')
  })

  it('parses structured AI correction JSON', () => {
    const parsed = parseAiCorrectionResponse({
      scorePoints: 8,
      scoreReasoning: 'Hauptproblem teilweise erkannt.',
      gradingComment: 'Solide, aber zu breit.',
      strengths: ['Aufbau erkennbar'],
      weaknesses: ['Zu wenig Schwerpunkt'],
      tags: ['schwerpunktsetzung'],
      confidence: 'medium',
      improvementSuggestions: [
        {
          category: 'structure',
          priority: 'high',
          title: 'Schwerpunkt setzen',
          detail: 'Pruefe die zentrale Frage zuerst.'
        }
      ],
      inlineComments: []
    })

    expect(parsed.scorePoints).toBe(8)
    expect(parsed.improvementSuggestions[0].category).toBe('structure')
  })
})
```

- [ ] **Step 2: Run test and verify failure**

Run: `pnpm vitest run tests/main/aiCorrection.test.ts`

Expected: FAIL because `aiCorrection.ts` does not exist.

- [ ] **Step 3: Implement prompt and response parser**

Create `src/main/services/aiCorrection.ts`:

```ts
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { z } from 'zod'
import { aiCorrectionDraftSchema, type Attachment, type ExamType, type LegalArea } from '@shared/schemas'

export const AI_CORRECTION_PROMPT_VERSION = 'ai-correction-v1'

const aiResponseSchema = z.object({
  scorePoints: z.number().min(0).max(18).refine((value) => Number.isInteger(value * 2)),
  scoreReasoning: z.string().min(1),
  gradingComment: z.string().min(1),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  tags: z.array(z.string()),
  confidence: z.enum(['low', 'medium', 'high']),
  improvementSuggestions: z.array(z.object({
    category: z.enum(['issue_spotting', 'law', 'procedure', 'structure', 'argumentation', 'style', 'time_management', 'other']),
    priority: z.enum(['low', 'medium', 'high']),
    title: z.string().min(1),
    detail: z.string().min(1)
  })),
  inlineComments: z.array(z.object({
    selectedText: z.string().min(1),
    prefix: z.string().default(''),
    suffix: z.string().default(''),
    body: z.string().min(1),
    tags: z.array(z.string()).default([])
  }))
})

export type AiPromptContext = {
  examTitle: string
  legalArea: LegalArea | null
  examType: ExamType | null
  sourceName: string | null
  submissionText: string
  hasAssignment: boolean
  hasModelSolution: boolean
}

export function buildAiCorrectionPrompt(context: AiPromptContext): string {
  return [
    'Du bist ein juristischer Korrektor fuer Uebungsklausuren im 2. Staatsexamen Bayern.',
    'Bewerte streng nach der Bayern 0-18 Punkteskala inklusive halber Punkte.',
    'Die Bewertung ist ein Lernwerkzeug, keine offizielle Pruefungskorrektur.',
    '',
    `Pruefung: ${context.examTitle}`,
    `Rechtsgebiet: ${context.legalArea ?? 'nicht angegeben'}`,
    `Klausurtyp: ${context.examType ?? 'nicht angegeben'}`,
    `Quelle: ${context.sourceName ?? 'nicht angegeben'}`,
    `Aufgabenstellung vorhanden: ${context.hasAssignment ? 'ja' : 'nein'}`,
    `Musterloesung vorhanden: ${context.hasModelSolution ? 'ja' : 'nein'}`,
    '',
    'Pruefe besonders:',
    '- Wurden Hauptprobleme und tragende Normen erkannt?',
    '- Wurden sie vertretbar, methodisch sauber und differenziert geloest?',
    '- Ist der Aufbau klausurtypgerecht, klar und schwerpunktorientiert?',
    '- Ist die Darstellung nuechtern, folgerichtig und korrekturfreundlich?',
    '- Welche Basiselemente tragen die Mindestleistung?',
    '- Welche vertiefenden Zusatzprobleme fehlen?',
    '- Welche konkrete Aenderung bringt bei der naechsten Klausur am meisten Punkte?',
    '',
    'Gib ausschliesslich JSON im vorgegebenen Schema zurueck.',
    '',
    'Abgabe:',
    context.submissionText
  ].join('\\n')
}

export function parseAiCorrectionResponse(value: unknown): z.infer<typeof aiResponseSchema> {
  return aiResponseSchema.parse(value)
}
```

- [ ] **Step 4: Add OpenAI request function**

In the same file add:

```ts
export async function requestOpenAiCorrection(input: {
  apiKey: string
  model: string
  prompt: string
  attachments: Array<{ attachment: Attachment; absolutePath: string }>
}): Promise<z.infer<typeof aiResponseSchema>> {
  const content: Array<Record<string, unknown>> = [{ type: 'input_text', text: input.prompt }]

  for (const item of input.attachments) {
    if (item.attachment.mimeType === 'application/pdf' || item.attachment.originalName.toLowerCase().endsWith('.pdf')) {
      const bytes = await readFile(item.absolutePath)
      content.push({
        type: 'input_file',
        filename: basename(item.attachment.originalName),
        file_data: `data:application/pdf;base64,${bytes.toString('base64')}`
      })
    }
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: input.model,
      input: [{ role: 'user', content }],
      text: {
        format: {
          type: 'json_schema',
          name: 'jura_wolpertinger_ai_correction',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: [
              'scorePoints',
              'scoreReasoning',
              'gradingComment',
              'strengths',
              'weaknesses',
              'tags',
              'confidence',
              'improvementSuggestions',
              'inlineComments'
            ],
            properties: {
              scorePoints: { type: 'number', minimum: 0, maximum: 18 },
              scoreReasoning: { type: 'string' },
              gradingComment: { type: 'string' },
              strengths: { type: 'array', items: { type: 'string' } },
              weaknesses: { type: 'array', items: { type: 'string' } },
              tags: { type: 'array', items: { type: 'string' } },
              confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
              improvementSuggestions: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['category', 'priority', 'title', 'detail'],
                  properties: {
                    category: { type: 'string', enum: ['issue_spotting', 'law', 'procedure', 'structure', 'argumentation', 'style', 'time_management', 'other'] },
                    priority: { type: 'string', enum: ['low', 'medium', 'high'] },
                    title: { type: 'string' },
                    detail: { type: 'string' }
                  }
                }
              },
              inlineComments: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['selectedText', 'prefix', 'suffix', 'body', 'tags'],
                  properties: {
                    selectedText: { type: 'string' },
                    prefix: { type: 'string' },
                    suffix: { type: 'string' },
                    body: { type: 'string' },
                    tags: { type: 'array', items: { type: 'string' } }
                  }
                }
              }
            }
          }
        }
      }
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status} ${await response.text()}`)
  }

  const payload = await response.json() as { output_text?: string }
  if (!payload.output_text) throw new Error('OpenAI response did not contain output_text')
  return parseAiCorrectionResponse(JSON.parse(payload.output_text))
}
```

- [ ] **Step 5: Wire service generation method**

In `AppServices`, add `generateAiCorrectionDraft(submissionId: string)` that:

1. Loads AI settings for current user.
2. Loads submission details and exam attachments.
3. Builds plain text from TipTap content using a small helper.
4. Calls `requestOpenAiCorrection`.
5. Saves the result with `saveAiCorrectionDraft`.

Use a helper:

```ts
function tiptapToPlainText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const record = node as Record<string, unknown>
  const ownText = typeof record.text === 'string' ? record.text : ''
  const children = Array.isArray(record.content) ? record.content.map(tiptapToPlainText).join('\\n') : ''
  return [ownText, children].filter(Boolean).join('\\n')
}
```

- [ ] **Step 6: Wire IPC and preload**

In `src/main/index.ts`, register:

```ts
ipcMain.handle('ai:settingsStatus', () => services.getAiSettingsStatus())
ipcMain.handle('ai:saveSettings', (_event, input: SaveAiSettingsInput) => services.saveAiSettings(input))
ipcMain.handle('ai:generateCorrectionDraft', (_event, input: GenerateAiCorrectionInput) =>
  services.generateAiCorrectionDraft(input.submissionId)
)
ipcMain.handle('ai:listCorrectionDrafts', (_event, submissionId: string) =>
  services.listAiCorrectionDrafts(submissionId)
)
ipcMain.handle('ai:acceptCorrectionDraft', (_event, draftId: string) =>
  services.acceptAiCorrectionDraft(draftId)
)
ipcMain.handle('ai:rejectCorrectionDraft', (_event, draftId: string) =>
  services.rejectAiCorrectionDraft(draftId)
)
```

In `src/preload/index.ts`, expose matching methods.

- [ ] **Step 7: Run tests and typecheck**

Run:

```bash
pnpm vitest run tests/main/aiCorrection.test.ts tests/main/services.test.ts
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/main/services/aiCorrection.ts src/main/services/services.ts src/main/index.ts src/preload/index.ts tests/main/aiCorrection.test.ts
git commit -m "Add OpenAI correction draft service"
```

## Task 4: Exam Metadata and Upload Role UI

**Files:**
- Modify: `src/renderer/src/views/ExamView.vue`
- Modify: `src/renderer/src/styles/main.css`
- Modify: `docs/user-stories.md`

- [ ] **Step 1: Add user story**

In `docs/user-stories.md`, add:

```md
### Quellen und Musterloesungen verwalten

Als Referendar:in moechte ich Aufgabenstellung, Bearbeitervermerk und Musterloesung einer Pruefung zuordnen, damit eine spaetere KI-Korrektur den richtigen Kontext nutzt.

Akzeptanz:

- Rechtsgebiet, Klausurtyp, Quelle und optionale URL koennen an der Pruefung gespeichert werden.
- Uploads erhalten Rollen wie Aufgabenstellung, Bearbeitervermerk oder Musterloesung.
- Fremde Klausurentexte werden nicht mitgeliefert, sondern nur durch Nutzer:innen importiert.
```

- [ ] **Step 2: Add metadata state**

In `ExamView.vue`, add refs:

```ts
const legalArea = ref<ExamDetails['legalArea']>(null)
const examType = ref<ExamDetails['examType']>(null)
const sourceName = ref('')
const sourceUrl = ref('')
const nextAttachmentRole = ref<'assignment' | 'candidate_note' | 'model_solution' | 'other'>('assignment')
```

In `load()`:

```ts
legalArea.value = exam.value.legalArea
examType.value = exam.value.examType
sourceName.value = exam.value.sourceName ?? ''
sourceUrl.value = exam.value.sourceUrl ?? ''
```

In `saveMeta()` include:

```ts
legalArea: legalArea.value,
examType: examType.value,
sourceName: sourceName.value,
sourceUrl: sourceUrl.value
```

- [ ] **Step 3: Add UI fields**

In the metadata section of `ExamView.vue`, add:

```vue
<label>
  Rechtsgebiet
  <select v-model="legalArea" @change="saveMeta">
    <option :value="null">Nicht gesetzt</option>
    <option value="civil">Zivilrecht</option>
    <option value="criminal">Strafrecht</option>
    <option value="public">Oeffentliches Recht</option>
    <option value="mixed">Gemischt</option>
    <option value="other">Sonstiges</option>
  </select>
</label>
<label>
  Klausurtyp
  <select v-model="examType" @change="saveMeta">
    <option :value="null">Nicht gesetzt</option>
    <option value="judgment">Urteil</option>
    <option value="order">Beschluss</option>
    <option value="relation">Relation</option>
    <option value="indictment">Anklage</option>
    <option value="expert_opinion">Gutachten</option>
    <option value="pleading">Schriftsatz</option>
    <option value="other">Sonstiges</option>
  </select>
</label>
<label>
  Quelle oder Anbieter
  <input v-model="sourceName" placeholder="z. B. Hemmer, AG, freie Quelle" @blur="saveMeta" />
</label>
<label>
  Quellen-URL
  <input v-model="sourceUrl" placeholder="https://..." @blur="saveMeta" />
</label>
```

In the file section add role picker:

```vue
<select v-model="nextAttachmentRole" class="compact-select" title="Dateirolle">
  <option value="assignment">Aufgabenstellung</option>
  <option value="candidate_note">Bearbeitervermerk</option>
  <option value="model_solution">Musterloesung</option>
  <option value="other">Sonstiges</option>
</select>
<button title="Datei hinzufügen" @click="addAttachment"><Plus :size="16" /></button>
```

Update `addAttachment()`:

```ts
await api.addAttachment(exam.value.id, nextAttachmentRole.value)
```

Show role in attachment rows:

```vue
<small>{{ attachmentRoleLabel(attachment.role) }}</small>
```

- [ ] **Step 4: Add role labels**

```ts
function attachmentRoleLabel(role: string): string {
  return {
    assignment: 'Aufgabenstellung',
    candidate_note: 'Bearbeitervermerk',
    model_solution: 'Musterloesung',
    other: 'Sonstiges'
  }[role] ?? 'Sonstiges'
}
```

- [ ] **Step 5: Run typecheck**

Run: `pnpm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/views/ExamView.vue src/renderer/src/styles/main.css docs/user-stories.md
git commit -m "Add exam source metadata UI"
```

## Task 5: AI Settings and Correction Review UI

**Files:**
- Modify: `src/renderer/src/views/CorrectionView.vue`
- Modify: `src/renderer/src/views/HelpView.vue`
- Modify: `src/renderer/src/styles/main.css`

- [ ] **Step 1: Add AI state**

In `CorrectionView.vue`, import `AiCorrectionDraft` and add refs:

```ts
import type { AiCorrectionDraft, Correction, InlineComment } from '@shared/schemas'

const aiSettings = ref<{ configured: boolean; model: string | null }>({ configured: false, model: null })
const aiDrafts = ref<AiCorrectionDraft[]>([])
const selectedAiDraft = computed(() => aiDrafts.value.find((draft) => draft.status === 'draft') ?? null)
const aiApiKeyInput = ref('')
const aiModelInput = ref('gpt-5')
const aiBusy = ref(false)
const aiNotice = ref('')
```

In `load()`:

```ts
aiSettings.value = await api.getAiSettingsStatus()
aiDrafts.value = submission.value ? await api.listAiCorrectionDrafts(submission.value.id) : []
```

- [ ] **Step 2: Add settings UI in header**

In `CorrectionView.vue` header actions, add:

```vue
<button class="secondary" type="button" @click="showAiSettings = !showAiSettings">
  KI einrichten
</button>
<button type="button" :disabled="aiBusy || !aiSettings.configured" @click="generateAiDraft">
  KI-Korrektur vorschlagen
</button>
```

Add settings panel:

```vue
<section v-if="showAiSettings" class="correction-assessment-panel ai-settings-panel">
  <h2>KI-Korrektur</h2>
  <p class="field-hint">
    Aufgabenstellung, Musterloesung und Abgabe werden fuer die Korrektur an den konfigurierten KI-Anbieter uebertragen.
  </p>
  <label>
    OpenAI API-Key
    <input v-model="aiApiKeyInput" type="password" placeholder="sk-..." />
  </label>
  <label>
    Modell
    <input v-model="aiModelInput" placeholder="gpt-5" />
  </label>
  <button type="button" @click="saveAiSettings">Speichern</button>
</section>
```

- [ ] **Step 3: Add draft review panel**

Below the assessment panel:

```vue
<section v-if="selectedAiDraft" class="correction-assessment-panel ai-draft-panel">
  <h2>KI-Vorschlag</h2>
  <div class="correction-score-grid">
    <strong>{{ formatScoreInput(selectedAiDraft.score.points) }} Punkte</strong>
    <p class="field-hint">{{ selectedAiDraft.scoreReasoning }}</p>
  </div>
  <p>{{ selectedAiDraft.gradingComment }}</p>
  <h3>Verbesserungsvorschlaege</h3>
  <ul>
    <li v-for="item in selectedAiDraft.improvementSuggestions" :key="`${item.category}-${item.title}`">
      <strong>{{ item.title }}</strong>
      <span>{{ item.detail }}</span>
    </li>
  </ul>
  <div class="dialog-actions">
    <button type="button" class="secondary" @click="rejectAiDraft(selectedAiDraft.id)">Verwerfen</button>
    <button type="button" @click="acceptAiDraft(selectedAiDraft.id)">Uebernehmen</button>
  </div>
</section>
```

- [ ] **Step 4: Add methods**

```ts
const showAiSettings = ref(false)

async function saveAiSettings(): Promise<void> {
  actionError.value = ''
  try {
    aiSettings.value = await api.saveAiSettings({
      provider: 'openai',
      apiKey: aiApiKeyInput.value,
      model: aiModelInput.value.trim() || 'gpt-5'
    })
    aiApiKeyInput.value = ''
    aiNotice.value = 'KI-Einstellungen gespeichert.'
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : String(error)
  }
}

async function generateAiDraft(): Promise<void> {
  if (!submission.value) return
  aiBusy.value = true
  actionError.value = ''
  try {
    await api.generateAiCorrectionDraft({ submissionId: submission.value.id })
    await load()
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : String(error)
  } finally {
    aiBusy.value = false
  }
}

async function acceptAiDraft(id: string): Promise<void> {
  await api.acceptAiCorrectionDraft(id)
  await load()
}

async function rejectAiDraft(id: string): Promise<void> {
  await api.rejectAiCorrectionDraft(id)
  await load()
}
```

- [ ] **Step 5: Update help page**

Add FAQ item in `HelpView.vue`:

```ts
{
  question: 'Was passiert bei einer KI-Korrektur?',
  answer:
    'Die App sendet die ausgewaehlte Abgabe und passende Unterlagen wie Aufgabenstellung oder Musterloesung an den konfigurierten KI-Anbieter. Das Ergebnis ist ein Korrekturvorschlag, den du pruefen, bearbeiten, uebernehmen oder verwerfen kannst.'
}
```

- [ ] **Step 6: Run typecheck**

Run: `pnpm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/views/CorrectionView.vue src/renderer/src/views/HelpView.vue src/renderer/src/styles/main.css
git commit -m "Add AI correction review UI"
```

## Task 6: Learning Tasks in Analytics

**Files:**
- Modify: `src/shared/ipc.ts`
- Modify: `src/main/services/services.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/index.ts`
- Modify: `src/renderer/src/views/AnalyticsView.vue`
- Test: `tests/main/services.test.ts`

- [ ] **Step 1: Add failing learning task test**

Add to `tests/main/services.test.ts`:

```ts
it('updates learning task status', () => {
  const exam = services.createExam({ title: 'Lernaufgabe' })
  const submission = services.submitExam(exam.id)
  const draft = services.saveAiCorrectionDraft({
    submissionId: submission.id,
    provider: 'openai',
    model: 'gpt-5',
    scorePoints: 6,
    scoreReasoning: 'Knapp brauchbar.',
    gradingComment: 'Mehr Struktur noetig.',
    strengths: [],
    weaknesses: ['Aufbau'],
    tags: ['aufbau'],
    confidence: 'medium',
    improvementSuggestions: [{
      category: 'structure',
      priority: 'high',
      title: 'Aufbau trainieren',
      detail: 'Vor dem Schreiben Gliederung erstellen.'
    }],
    inlineComments: []
  })
  services.acceptAiCorrectionDraft(draft.id)
  const task = services.listLearningTasks()[0]

  expect(services.updateLearningTaskStatus(task.id, 'done').status).toBe('done')
})
```

- [ ] **Step 2: Expose learning task APIs**

Wire `listLearningTasks` and `updateLearningTaskStatus` through `src/shared/ipc.ts`, `src/preload/index.ts`, and `src/main/index.ts`.

- [ ] **Step 3: Add analytics panel**

In `AnalyticsView.vue`, load tasks:

```ts
import type { AnalyticsEntry } from '@shared/ipc'
import type { LearningTask } from '@shared/schemas'

const learningTasks = ref<LearningTask[]>([])

async function load(): Promise<void> {
  const [nextEntries, nextTasks] = await Promise.all([
    api.listAnalyticsEntries(),
    api.listLearningTasks()
  ])
  entries.value = nextEntries
  learningTasks.value = nextTasks
}
```

Add computed summaries:

```ts
const openLearningTasks = computed(() => learningTasks.value.filter((task) => task.status !== 'done'))
const topLearningCategories = computed(() => {
  const counts = new Map<string, number>()
  for (const task of openLearningTasks.value) counts.set(task.category, (counts.get(task.category) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
})
```

Add UI below metrics:

```vue
<section class="analytics-panel">
  <div class="panel-header">
    <div>
      <h2>Lernaufgaben</h2>
      <p class="analytics-panel-copy">Aus uebernommenen KI-Korrekturen abgeleitete offene Aufgaben.</p>
    </div>
  </div>
  <div v-if="openLearningTasks.length" class="analytics-table">
    <div v-for="task in openLearningTasks.slice(0, 8)" :key="task.id" class="analytics-table-row">
      <strong>{{ task.title }}</strong>
      <span>{{ task.category }}</span>
      <span>{{ task.priority }}</span>
      <button class="secondary" type="button" @click="markTaskDone(task.id)">Erledigt</button>
    </div>
  </div>
  <p v-else class="empty-state">Keine offenen Lernaufgaben.</p>
</section>
```

Add method:

```ts
async function markTaskDone(taskId: string): Promise<void> {
  await api.updateLearningTaskStatus(taskId, 'done')
  learningTasks.value = await api.listLearningTasks()
}
```

- [ ] **Step 4: Run tests and typecheck**

Run:

```bash
pnpm vitest run tests/main/services.test.ts
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/ipc.ts src/main/services/services.ts src/preload/index.ts src/main/index.ts src/renderer/src/views/AnalyticsView.vue tests/main/services.test.ts
git commit -m "Show AI learning tasks in analytics"
```

## Task 7: Package Export, Demo Data, and Final Verification

**Files:**
- Modify: `src/main/services/services.ts`
- Modify: `src/main/services/demoData.ts`
- Modify: `docs/architecture.md`
- Modify: `docs/user-stories.md`
- Test: `tests/main/services.test.ts`

- [ ] **Step 1: Extend .jura package tests**

Update the export/import test in `tests/main/services.test.ts` to assert metadata, attachment roles, AI drafts, and learning tasks are either exported/imported or intentionally excluded.

For MVP, choose this explicit rule:

```ts
expect(imported.legalArea).toBe('civil')
expect(imported.attachments[0].role).toBe('model_solution')
expect(importedServices.listLearningTasks()).toEqual([])
```

Rationale: `.jura` v1 remains backward-compatible for core exam data; AI drafts and learning tasks are local study artifacts and can be added to a future `.jura` format bump.

- [ ] **Step 2: Update export/import document schema**

Include exam metadata and attachment role in package export/import because those are part of the exam, not only local AI state. Do not export API keys. Do not export AI settings. Do not export unaccepted AI drafts.

- [ ] **Step 3: Update architecture docs**

In `docs/architecture.md`, update:

- Schema version to `3`.
- ER diagram with `ai_correction_drafts`, `learning_tasks`, `ai_settings`.
- IPC table with AI settings and correction draft methods.
- Add a short `KI-Korrektur` section explaining cloud call boundaries and Renderer isolation.

- [ ] **Step 4: Update demo data lightly**

In `src/main/services/demoData.ts`, add metadata to demo exams:

```ts
legalArea: 'civil',
examType: 'judgment',
sourceName: 'Demo',
sourceUrl: null
```

Do not add real provider names or bundled foreign Klausuren.

- [ ] **Step 5: Run full relevant checks**

Run:

```bash
pnpm run typecheck
pnpm test
```

Expected: PASS.

Run E2E if local Electron environment is stable:

```bash
pnpm run test:e2e
```

Expected: PASS or document exact local blocker.

- [ ] **Step 6: Commit**

```bash
git add src/main/services/services.ts src/main/services/demoData.ts docs/architecture.md docs/user-stories.md tests/main/services.test.ts
git commit -m "Document AI training loop architecture"
```

## Execution Notes

- Keep all normal data local except explicit AI correction requests.
- Do not put API keys in Renderer or `.jura` packages.
- Use native `fetch`; do not add an OpenAI SDK dependency unless native fetch proves insufficient.
- Prompt/version string is `ai-correction-v1` and must be stored with drafts.
- Accepted AI drafts become normal corrections; raw drafts remain visibly marked as AI-originated.
- If OpenAI response shape changes during implementation, prefer a small adapter in `aiCorrection.ts` over spreading provider parsing through services.

## Self-Review

- Spec coverage: metadata, upload roles, own API key, cloud-only AI, existing correction integration, point proposal, improvement suggestions, learning tasks, privacy, and tests are covered.
- Scope check: provider-operated access, local models, full calendar, and bundled Klausuren are intentionally excluded.
- Placeholder scan: no `TBD`, `TODO`, or unspecified "handle edge cases" steps remain.
- Type consistency: names use `AiCorrectionDraft`, `LearningTask`, `AttachmentRole`, `LegalArea`, `ExamType`, and `ai-correction-v1` consistently across tasks.
