import { describe, expect, it } from 'vitest'
import {
  aiCorrectionDraftSchema,
  attachmentSchema,
  correctionSchema,
  examListItemSchema,
  juraManifestSchema,
  learningCardSchema,
  learningCollectionSchema,
  learningDashboardSchema,
  learningReviewEventSchema,
  learningTaskSchema,
  revisionSchema,
  reviewCardSchema,
  reviewRatingSchema,
  scoreSchema,
  submissionSchema
} from '@shared/schemas'
import {
  APP_VERSION,
  DOCUMENT_SCHEMA_VERSION,
  EDITOR_SCHEMA_VERSION,
  JURA_FORMAT,
  JURA_FORMAT_VERSION
} from '@shared/constants'
import { hashJson } from '@main/services/utils'

describe('shared schemas', () => {
  it('validates .jura manifest version 1', () => {
    expect(
      juraManifestSchema.parse({
        format: JURA_FORMAT,
        formatVersion: JURA_FORMAT_VERSION,
        minimumAppVersion: APP_VERSION,
        createdWithAppVersion: APP_VERSION,
        documentSchemaVersion: DOCUMENT_SCHEMA_VERSION,
        createdAt: new Date().toISOString(),
        documentId: crypto.randomUUID()
      }).format
    ).toBe(JURA_FORMAT)
  })

  it('validates revision, submission and correction document shapes', () => {
    const examId = crypto.randomUUID()
    const userId = crypto.randomUUID()
    const revisionId = crypto.randomUUID()
    const submissionId = crypto.randomUUID()
    const correctionId = crypto.randomUUID()
    const content = { type: 'doc', content: [{ type: 'paragraph' }] }
    const contentHash = hashJson(content)

    expect(
      revisionSchema.parse({
        schemaVersion: 1,
        editorSchemaVersion: EDITOR_SCHEMA_VERSION,
        id: revisionId,
        userId,
        examId,
        createdAt: new Date().toISOString(),
        kind: 'autosave',
        contentFormat: 'tiptap-v1',
        contentHash,
        content
      }).contentHash
    ).toBe(contentHash)

    expect(
      submissionSchema.parse({
        schemaVersion: 1,
        id: submissionId,
        userId,
        examId,
        submittedAt: new Date().toISOString(),
        revisionId,
        contentHash,
        canContinueEditing: true,
        pdfPath: null
      }).revisionId
    ).toBe(revisionId)

    expect(
      correctionSchema.parse({
        schemaVersion: 1,
        id: correctionId,
        userId,
        targetSubmissionId: submissionId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        score: { system: 'bayern-0-18', points: 12 },
        gradingComment: 'Sauber.',
        tags: [],
        inlineComments: []
      }).score.points
    ).toBe(12)
  })

  it('accepts Bayern points from 0 to 18 in 0.5 steps', () => {
    expect(scoreSchema.safeParse({ system: 'bayern-0-18', points: 0 }).success).toBe(true)
    expect(scoreSchema.safeParse({ system: 'bayern-0-18', points: 12.5 }).success).toBe(true)
    expect(scoreSchema.safeParse({ system: 'bayern-0-18', points: 18 }).success).toBe(true)
    expect(scoreSchema.safeParse({ system: 'bayern-0-18', points: null }).success).toBe(true)
    expect(scoreSchema.safeParse({ system: 'bayern-0-18', points: 12.25 }).success).toBe(false)
    expect(scoreSchema.safeParse({ system: 'bayern-0-18', points: 18.5 }).success).toBe(false)
    expect(scoreSchema.safeParse({ system: 'bayern-0-18', points: 19 }).success).toBe(false)
  })

  it('hashes JSON content stably independent of object key order', () => {
    expect(hashJson({ b: 2, a: 1 })).toBe(hashJson({ a: 1, b: 2 }))
  })

  it('validates exam metadata and attachment roles', () => {
    const examWithoutMetadata = examListItemSchema.parse({
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
      latestScore: null
    })
    expect(examWithoutMetadata.legalArea).toBeNull()
    expect(examWithoutMetadata.examType).toBeNull()
    expect(examWithoutMetadata.sourceName).toBeNull()
    expect(examWithoutMetadata.sourceUrl).toBeNull()

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

    expect(
      attachmentSchema.parse({
        schemaVersion: 1,
        id: crypto.randomUUID(),
        userId: crypto.randomUUID(),
        examId: crypto.randomUUID(),
        originalName: 'sachverhalt.pdf',
        storedName: 'stored.pdf',
        mimeType: 'application/pdf',
        size: 12,
        relativePath: 'exams/x/attachments/y/stored.pdf',
        createdAt: new Date().toISOString()
      }).role
    ).toBe('other')
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
      inlineComments: [
        {
          selectedText: 'zentrale Anspruchsgrundlage',
          prefix: 'Pruefe die ',
          suffix: ' vor Nebenfragen.',
          body: 'Hier sollte der Schwerpunkt der Klausur frueher sichtbar werden.',
          tags: ['schwerpunktsetzung']
        }
      ]
    })
    expect(draft.score.points).toBe(8.5)
    expect(draft.inlineComments[0].selectedText).toBe('zentrale Anspruchsgrundlage')

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

  it('validates learning cards, review ratings and dashboard summaries', () => {
    const now = new Date().toISOString()
    const userId = crypto.randomUUID()
    const collectionId = crypto.randomUUID()
    const cardId = crypto.randomUUID()

    expect(reviewRatingSchema.parse(1)).toBe(1)
    expect(reviewRatingSchema.parse(4)).toBe(4)
    expect(() => reviewRatingSchema.parse(5)).toThrow()

    expect(
      learningCollectionSchema.parse({
        schemaVersion: 1,
        id: collectionId,
        userId,
        name: 'Strafrecht AT',
        description: '',
        subject: 'Strafrecht',
        source: null,
        cardCount: 12,
        dueCount: 3,
        createdAt: now,
        updatedAt: now
      }).name
    ).toBe('Strafrecht AT')

    const card = learningCardSchema.parse({
      schemaVersion: 1,
      id: cardId,
      userId,
      collectionId,
      externalId: 'card-1',
      title: 'Rücktritt',
      frontMarkdown: 'Wann ist ein Rücktritt möglich?',
      backMarkdown: 'Nach § 24 StGB bei Aufgabe der weiteren Tatausführung.',
      tags: ['strafrecht', 'rücktritt'],
      isArchived: false,
      createdAt: now,
      updatedAt: now
    })
    expect(card.tags).toContain('rücktritt')

    expect(
      reviewCardSchema.parse({
        ...card,
        dueAt: now,
        lastRating: null,
        reps: 0,
        lapses: 0
      }).reps
    ).toBe(0)

    expect(
      learningReviewEventSchema.parse({
        schemaVersion: 1,
        id: crypto.randomUUID(),
        userId,
        cardId,
        rating: 3,
        reviewedAt: now,
        elapsedMs: 1200
      }).rating
    ).toBe(3)

    expect(
      learningDashboardSchema.parse({
        dueCount: 3,
        totalCards: 12,
        collectionCount: 1,
        streakDays: 4,
        freeDaysRemainingThisWeek: 2,
        learnedToday: true
      }).learnedToday
    ).toBe(true)
  })
})
