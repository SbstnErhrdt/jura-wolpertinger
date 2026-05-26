import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import {
  aiConfidenceSchema,
  attachmentRoleSchema,
  improvementCategorySchema,
  learningTaskPrioritySchema,
  type AttachmentRole
} from '@shared/schemas'
import type { SaveAiCorrectionDraftInput } from '@shared/ipc'

export const AI_CORRECTION_PROMPT_VERSION = 'ai-correction-v2'
const MAX_OPENAI_FILE_BYTES = 50 * 1024 * 1024
const MAX_OPENAI_FILE_COUNT = 10
const OPENAI_CORRECTION_REASONING_EFFORT = 'high'

const correctionResponseJsonSchema = {
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
    scorePoints: { type: 'number', minimum: 0, maximum: 18, multipleOf: 0.5 },
    scoreReasoning: { type: 'string' },
    gradingComment: { type: 'string' },
    strengths: { type: 'array', items: { type: 'string' } },
    weaknesses: { type: 'array', items: { type: 'string' } },
    tags: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: aiConfidenceSchema.options },
    improvementSuggestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['category', 'priority', 'title', 'detail'],
        properties: {
          category: { type: 'string', enum: improvementCategorySchema.options },
          priority: { type: 'string', enum: learningTaskPrioritySchema.options },
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
} as const

const scorePointsSchema = z
  .number()
  .min(0)
  .max(18)
  .refine((value) => Number.isInteger(value * 2), 'Score must be in 0.5 increments')

const aiCorrectionResponseSchema = z.object({
  scorePoints: scorePointsSchema,
  scoreReasoning: z.string().min(1),
  gradingComment: z.string().min(1),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  tags: z.array(z.string()),
  confidence: aiConfidenceSchema,
  improvementSuggestions: z.array(
    z.object({
      category: improvementCategorySchema,
      priority: learningTaskPrioritySchema,
      title: z.string().min(1),
      detail: z.string().min(1)
    })
  ),
  inlineComments: z.array(
    z.object({
      selectedText: z.string().min(1),
      prefix: z.string().default(''),
      suffix: z.string().default(''),
      body: z.string().min(1),
      tags: z.array(z.string()).default([])
    })
  )
})

export type ParsedAiCorrectionResponse = z.infer<typeof aiCorrectionResponseSchema>

export type AiCorrectionPromptAttachment = {
  role: AttachmentRole
  name: string
}

export type AiCorrectionPromptContext = {
  examTitle: string
  examTags: string[]
  examNotes: string
  submissionText: string
  submittedAt: string
  legalArea?: string | null
  examType?: string | null
  attachments?: AiCorrectionPromptAttachment[]
}

export type AiCorrectionRequestAttachment = AiCorrectionPromptAttachment & {
  absolutePath: string
  mimeType?: string | null
  size: number
}

export type RequestOpenAiCorrectionInput = {
  apiKey: string
  model: string
  prompt: string
  attachments: AiCorrectionRequestAttachment[]
}

export type RequestOpenAiConnectionTestInput = {
  apiKey: string
  model: string
}

export function buildAiCorrectionPrompt(context: AiCorrectionPromptContext): string {
  const attachmentList =
    context.attachments && context.attachments.length > 0
      ? context.attachments
          .map((attachment) => `- ${attachment.role}: ${attachment.name}`)
          .join('\n')
      : '- keine PDF-Anhaenge'

  return [
    `Prompt-Version: ${AI_CORRECTION_PROMPT_VERSION}`,
    '',
    'Du korrigierst eine juristische Uebungspruefung fuer Bayern.',
    'Bewerte streng, pruefungsnah und transparent nach Bayern 0-18 Punkten inklusive halber Punkte.',
    'Die Korrektur ist Lernfeedback, keine Rechtsberatung und keine offizielle Pruefungsbewertung.',
    '',
    `Pruefung: ${context.examTitle}`,
    `Abgegeben am: ${context.submittedAt}`,
    `Rechtsgebiet: ${context.legalArea ?? 'nicht angegeben'}`,
    `Klausurtyp: ${context.examType ?? 'nicht angegeben'}`,
    `Tags: ${context.examTags.length > 0 ? context.examTags.join(', ') : 'keine'}`,
    `Notizen: ${context.examNotes.trim() || 'keine'}`,
    '',
    'PDF-Anhaenge:',
    attachmentList,
    '',
    'Bewertungsauftrag:',
    '- Erstelle gedanklich zuerst ein Rohpunkteschema: Pflichtprobleme, Aufbaupunkte, Subsumtion, Methodik und Zusatzpunkte.',
    '- Identifiziere die Hauptprobleme der Aufgabe und der Bearbeitung.',
    '- Bewerte, ob Loesungswege vertretbar sind, auch wenn sie vom Erwartungshorizont abweichen.',
    '- Unterscheide Silber- und Goldelemente: Grundlagen muessen sicher sitzen, Zusatzprobleme duerfen gute Leistungen nach oben tragen.',
    '- Bewerte Gutachtenstil, Aufbau, Schwerpunktsetzung, Normbezug, Subsumtion und sprachliche Praezision.',
    '- Honorier vertretbare Argumentation; bestrafe bloss abweichende Ergebnisse nicht, wenn Methode und Begruendung tragen.',
    '- Begruende die Punktzahl knapp, aber nachvollziehbar.',
    '- Formuliere konkrete Verbesserungsvorschlaege fuer die naechste Bearbeitung.',
    '- Setze Inline-Kommentare nur auf Textstellen, die im Abgabetext wirklich vorkommen.',
    '',
    'Antwortformat:',
    'Gib ausschliesslich JSON entsprechend dem vorgegebenen Schema zurueck.',
    'Nutze die Felder scorePoints, scoreReasoning, gradingComment, strengths, weaknesses, tags, confidence, improvementSuggestions und inlineComments.',
    '',
    'Abgabetext (wortgetreuer Inhalt zwischen den Markierungen):',
    '<<<ABGABETEXT_BEGIN>>>',
    context.submissionText.trim() || '[leer]',
    '<<<ABGABETEXT_END>>>'
  ].join('\n')
}

export function parseAiCorrectionResponse(value: unknown): ParsedAiCorrectionResponse {
  const parsedValue = typeof value === 'string' ? JSON.parse(value) : value
  return aiCorrectionResponseSchema.parse(normalizeAiCorrectionResponse(parsedValue))
}

export function extractOpenAiResponseText(value: unknown): string {
  if (isRecord(value) && typeof value.output_text === 'string') return value.output_text

  if (isRecord(value) && Array.isArray(value.output)) {
    for (const outputItem of value.output) {
      if (!isRecord(outputItem) || !Array.isArray(outputItem.content)) continue
      for (const contentItem of outputItem.content) {
        if (
          isRecord(contentItem) &&
          contentItem.type === 'output_text' &&
          typeof contentItem.text === 'string'
        ) {
          return contentItem.text
        }
      }
    }
  }

  throw new Error('OpenAI response did not contain output_text')
}

export async function requestOpenAiCorrection(
  input: RequestOpenAiCorrectionInput
): Promise<ParsedAiCorrectionResponse> {
  validateOpenAiAttachments(input.attachments)

  const content = [
    { type: 'input_text', text: input.prompt },
    ...(await Promise.all(input.attachments.map(inputFileFromAttachment)))
  ]

  const firstDraft = await requestStructuredCorrection({
    apiKey: input.apiKey,
    model: input.model,
    content
  })
  const reviewPrompt = buildAiCorrectionReviewPrompt(input.prompt, firstDraft)
  const reviewContent = [
    { type: 'input_text', text: reviewPrompt },
    ...content.filter((item) => item.type === 'input_file')
  ]

  return requestStructuredCorrection({
    apiKey: input.apiKey,
    model: input.model,
    content: reviewContent
  })
}

export async function requestOpenAiConnectionTest(input: RequestOpenAiConnectionTestInput): Promise<{
  ok: boolean
  model: string
  message: string
}> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: input.model,
      store: false,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: 'Verbindungstest fuer Jura Wolpertinger. Antworte kurz mit OK.'
            }
          ]
        }
      ]
    })
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    const detail = body ? `: ${body.slice(0, 500)}` : ''
    throw new Error(`OpenAI connection test failed (${response.status})${detail}`)
  }

  await response.json()
  return {
    ok: true,
    model: input.model,
    message: 'Verbindung erfolgreich.'
  }
}

function buildAiCorrectionReviewPrompt(
  originalPrompt: string,
  firstDraft: ParsedAiCorrectionResponse
): string {
  return [
    'Zweitkorrektur und Finalisierung der KI-Korrektur.',
    '',
    'Rolle:',
    '- Du bist ein strenger zweiter juristischer Korrektor fuer eine bayerische Uebungspruefung.',
    '- Pruefe die Erstkorrektur kritisch, korrigiere sie bei Bedarf und gib die finale Korrektur aus.',
    '',
    'Pruefschritte:',
    '- Ist die Punktzahl auf der Bayern-Skala 0-18 inklusive halber Punkte plausibel?',
    '- Wurde das gedankliche Rohpunkteschema zur Aufgabe, Musterloesung und Bearbeitung passend angewendet?',
    '- Sind Hauptprobleme, vertretbare Loesungswege, Gutachtenstil, Aufbau und Subsumtion angemessen gewichtet?',
    '- Sind Inline-Kommentare nur auf Woerter oder Passagen gesetzt, die im Abgabetext tatsaechlich vorkommen?',
    '- Sind Verbesserungsvorschlaege konkret genug, um fuer die naechste Klausur nutzbar zu sein?',
    '- Entferne Halluzinationen, nicht belegbare Aussagen und zu generische Kritik.',
    '',
    'Antwortformat:',
    'Gib ausschliesslich die finale JSON-Korrektur entsprechend dem vorgegebenen Schema zurueck.',
    '',
    'Urspruenglicher Bewertungsauftrag:',
    '<<<ORIGINAL_PROMPT_BEGIN>>>',
    originalPrompt,
    '<<<ORIGINAL_PROMPT_END>>>',
    '',
    'Erstkorrektur:',
    '<<<FIRST_DRAFT_JSON_BEGIN>>>',
    JSON.stringify(firstDraft),
    '<<<FIRST_DRAFT_JSON_END>>>'
  ].join('\n')
}

async function requestStructuredCorrection(input: {
  apiKey: string
  model: string
  content: Array<{ type: string; text?: string; filename?: string; file_data?: string }>
}): Promise<ParsedAiCorrectionResponse> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: input.model,
      store: false,
      reasoning: {
        effort: OPENAI_CORRECTION_REASONING_EFFORT
      },
      input: [
        {
          role: 'user',
          content: input.content
        }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'ai_correction_draft',
          strict: true,
          schema: correctionResponseJsonSchema
        }
      }
    })
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    const detail = body ? `: ${body.slice(0, 500)}` : ''
    throw new Error(`OpenAI correction request failed (${response.status})${detail}`)
  }

  return parseAiCorrectionResponse(extractOpenAiResponseText(await response.json()))
}

export function tiptapToPlainText(content: Record<string, unknown>): string {
  return plainTextFromTipTapNode(content).replace(/\n{3,}/g, '\n\n').trim()
}

function normalizeAiCorrectionResponse(value: unknown): unknown {
  if (!isRecord(value)) return value

  return {
    scorePoints: coalesce(value.scorePoints, value.score_points, readNested(value.score, 'points')),
    scoreReasoning: coalesce(value.scoreReasoning, value.score_reasoning, value.reasoning),
    gradingComment: coalesce(value.gradingComment, value.grading_comment),
    strengths: value.strengths,
    weaknesses: value.weaknesses,
    tags: value.tags,
    confidence: value.confidence,
    improvementSuggestions: normalizeImprovementSuggestions(
      coalesce(value.improvementSuggestions, value.improvement_suggestions)
    ),
    inlineComments: normalizeInlineComments(coalesce(value.inlineComments, value.inline_comments))
  }
}

function normalizeImprovementSuggestions(value: unknown): unknown {
  if (!Array.isArray(value)) return value
  return value.map((item) => {
    if (!isRecord(item)) return item
    return {
      category: item.category,
      priority: item.priority,
      title: item.title,
      detail: item.detail
    }
  })
}

function normalizeInlineComments(value: unknown): unknown {
  if (!Array.isArray(value)) return value
  return value.map((item) => {
    if (!isRecord(item)) return item
    return {
      selectedText: coalesce(item.selectedText, item.selected_text),
      prefix: item.prefix,
      suffix: item.suffix,
      body: item.body,
      tags: item.tags
    }
  })
}

async function inputFileFromAttachment(attachment: AiCorrectionRequestAttachment): Promise<{
  type: 'input_file'
  filename: string
  file_data: string
}> {
  attachmentRoleSchema.parse(attachment.role)
  const data = await readFile(attachment.absolutePath)
  const mimeType = attachment.mimeType ?? 'application/pdf'
  return {
    type: 'input_file',
    filename: attachment.name,
    file_data: `data:${mimeType};base64,${data.toString('base64')}`
  }
}

function validateOpenAiAttachments(attachments: AiCorrectionRequestAttachment[]): void {
  if (attachments.length > MAX_OPENAI_FILE_COUNT) {
    throw new Error(
      `Die ausgewählten KI-Unterlagen sind zu groß. Bitte reduziere die Dateien auf höchstens ${MAX_OPENAI_FILE_COUNT} PDF-Dateien.`
    )
  }

  const totalBytes = attachments.reduce((total, attachment) => total + attachment.size, 0)
  if (totalBytes > MAX_OPENAI_FILE_BYTES) {
    throw new Error(
      'Die ausgewählten KI-Unterlagen sind zu groß. Bitte reduziere die Dateien auf höchstens 50 MB insgesamt.'
    )
  }
}

function plainTextFromTipTapNode(node: unknown): string {
  if (!isRecord(node)) return ''
  if (typeof node.text === 'string') return node.text
  if (node.type === 'hardBreak') return '\n'

  const children = Array.isArray(node.content) ? node.content.map(plainTextFromTipTapNode) : []
  const joined = children.join('')

  if (node.type === 'doc') return children.join('\n\n')
  if (node.type === 'paragraph' || node.type === 'heading') return joined
  if (node.type === 'listItem') return `- ${joined}`
  if (node.type === 'bulletList' || node.type === 'orderedList') return children.join('\n')

  return joined
}

function coalesce(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined)
}

function readNested(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

type _DraftCompatibilityCheck = ParsedAiCorrectionResponse extends Omit<
  SaveAiCorrectionDraftInput,
  'submissionId' | 'provider' | 'model'
>
  ? true
  : never
