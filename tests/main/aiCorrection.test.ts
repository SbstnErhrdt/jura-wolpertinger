import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildAiCorrectionPrompt,
  extractOpenAiResponseText,
  parseAiCorrectionResponse,
  requestOpenAiConnectionTest,
  requestOpenAiCorrection
} from '@main/services/aiCorrection'

const readFileMock = vi.hoisted(() => vi.fn())

vi.mock('node:fs/promises', () => ({
  readFile: readFileMock
}))

describe('AI correction service', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    readFileMock.mockReset()
  })

  it('builds a Bayern correction prompt with exam context', () => {
    const prompt = buildAiCorrectionPrompt({
      examTitle: 'Probeexamen Zivilrecht I',
      examTags: ['zivilrecht', 'schuldrecht'],
      examNotes: 'Bearbeitervermerk beachten.',
      submissionText: 'A koennte gegen B einen Anspruch haben.',
      submittedAt: '2026-05-24T10:30:00.000Z',
      attachments: [
        { role: 'assignment', name: 'sachverhalt.pdf' },
        { role: 'model_solution', name: 'loesung.pdf' }
      ]
    })

    expect(prompt).toContain('Probeexamen Zivilrecht I')
    expect(prompt).toContain('Bayern 0-18')
    expect(prompt).toContain('Rohpunkteschema')
    expect(prompt).toContain('Hauptprobleme')
    expect(prompt).toContain('vertretbar')
    expect(prompt).toContain('Gutachtenstil')
    expect(prompt).toContain('Silber- und Goldelemente')
    expect(prompt).toContain('Verbesserungsvorschlaege')
    expect(prompt).toContain('A koennte gegen B einen Anspruch haben.')
  })

  it('parses a structured correction response', () => {
    const parsed = parseAiCorrectionResponse({
      scorePoints: 9.5,
      scoreReasoning: 'Die Hauptprobleme werden erkannt, aber nicht voll ausgeschoepft.',
      gradingComment: 'Solide Bearbeitung mit Luecken in der Schwerpunktsetzung.',
      strengths: ['Sauberer Obersatz', 'Vertretbare Ergebnisbildung'],
      weaknesses: ['Hauptprobleme zu knapp', 'Subsumtion teils pauschal'],
      tags: ['schwerpunktsetzung', 'subsumtion'],
      confidence: 'medium',
      improvementSuggestions: [
        {
          category: 'argumentation',
          priority: 'high',
          title: 'Subsumtion ausbauen',
          detail: 'Arbeite die streitigen Tatbestandsmerkmale konkreter am Sachverhalt ab.'
        }
      ],
      inlineComments: [
        {
          selectedText: 'Anspruch haben',
          prefix: 'A koennte gegen B einen ',
          suffix: '.',
          body: 'Anspruchsgrundlage genauer benennen.',
          tags: ['anspruchsgrundlage']
        }
      ]
    })

    expect(parsed).toEqual({
      scorePoints: 9.5,
      scoreReasoning: 'Die Hauptprobleme werden erkannt, aber nicht voll ausgeschoepft.',
      gradingComment: 'Solide Bearbeitung mit Luecken in der Schwerpunktsetzung.',
      strengths: ['Sauberer Obersatz', 'Vertretbare Ergebnisbildung'],
      weaknesses: ['Hauptprobleme zu knapp', 'Subsumtion teils pauschal'],
      tags: ['schwerpunktsetzung', 'subsumtion'],
      confidence: 'medium',
      improvementSuggestions: [
        {
          category: 'argumentation',
          priority: 'high',
          title: 'Subsumtion ausbauen',
          detail: 'Arbeite die streitigen Tatbestandsmerkmale konkreter am Sachverhalt ab.'
        }
      ],
      inlineComments: [
        {
          selectedText: 'Anspruch haben',
          prefix: 'A koennte gegen B einen ',
          suffix: '.',
          body: 'Anspruchsgrundlage genauer benennen.',
          tags: ['anspruchsgrundlage']
        }
      ]
    })
  })

  it('extracts structured output text from Responses API content items', () => {
    const response = {
      output: [
        {
          type: 'message',
          content: [
            { type: 'refusal', refusal: 'not this one' },
            {
              type: 'output_text',
              text: JSON.stringify({
                score_points: 8,
                reasoning: 'Noch ordentliche Ansaetze.',
                grading_comment: 'Ausbaufaehige, aber brauchbare Loesung.',
                strengths: ['Problem erkannt'],
                weaknesses: ['Begruendung knapp'],
                tags: ['begruendung'],
                confidence: 'low',
                improvement_suggestions: [],
                inline_comments: []
              })
            }
          ]
        }
      ]
    }

    expect(parseAiCorrectionResponse(extractOpenAiResponseText(response)).scorePoints).toBe(8)
  })

  it('rejects scores outside Bayern half-point steps', () => {
    expect(() =>
      parseAiCorrectionResponse({
        scorePoints: 9.25,
        scoreReasoning: 'Unzulaessiger Wert.',
        gradingComment: 'Kommentar.',
        strengths: [],
        weaknesses: [],
        tags: [],
        confidence: 'low',
        improvementSuggestions: [],
        inlineComments: []
      })
    ).toThrow(/0.5/)
  })

  it('requests a non-stored structured JSON schema correction from OpenAI', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(openAiJsonResponse({ scorePoints: 8, scoreReasoning: 'Erstkorrektur.' }))
      .mockResolvedValueOnce(openAiJsonResponse({ scorePoints: 9, scoreReasoning: 'Zweitkorrektur.' }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await requestOpenAiCorrection({
      apiKey: 'test-key',
      model: 'gpt-test',
      prompt: 'Korrigiere diese Abgabe.',
      attachments: []
    })

    expect(result.scorePoints).toBe(9)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [, firstRequestInit] = fetchMock.mock.calls[0]
    const firstBody = JSON.parse(firstRequestInit.body)
    const [, secondRequestInit] = fetchMock.mock.calls[1]
    const secondBody = JSON.parse(secondRequestInit.body)

    expect(firstBody.store).toBe(false)
    expect(firstBody.reasoning).toEqual({ effort: 'high' })
    expect(firstBody.text.format).toMatchObject({
      type: 'json_schema',
      name: 'ai_correction_draft',
      strict: true
    })
    expect(firstBody.text.format.schema).toMatchObject({
      type: 'object',
      additionalProperties: false
    })
    expect(firstBody.input[0]).toMatchObject({
      role: 'user',
      content: [{ type: 'input_text', text: 'Korrigiere diese Abgabe.' }]
    })
    expect(secondBody.store).toBe(false)
    expect(secondBody.reasoning).toEqual({ effort: 'high' })
    expect(secondBody.text.format.name).toBe('ai_correction_draft')
    expect(secondBody.input[0].content[0].text).toContain('Zweitkorrektur')
    expect(secondBody.input[0].content[0].text).toContain('"scorePoints":8')
  })

  it('includes under-limit PDF attachments as input_file data URLs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(openAiJsonResponse())
    vi.stubGlobal('fetch', fetchMock)
    readFileMock.mockResolvedValue(Buffer.from('PDF bytes'))

    await requestOpenAiCorrection({
      apiKey: 'test-key',
      model: 'gpt-test',
      prompt: 'Korrigiere.',
      attachments: [
        {
          role: 'assignment',
          name: 'sachverhalt.pdf',
          absolutePath: '/tmp/sachverhalt.pdf',
          mimeType: 'application/pdf',
          size: 9
        }
      ]
    })

    expect(readFileMock).toHaveBeenCalledWith('/tmp/sachverhalt.pdf')
    const [, requestInit] = fetchMock.mock.calls[0]
    const body = JSON.parse(requestInit.body)

    expect(body.input[0].content).toContainEqual({
      type: 'input_file',
      filename: 'sachverhalt.pdf',
      file_data: `data:application/pdf;base64,${Buffer.from('PDF bytes').toString('base64')}`
    })
    const [, reviewRequestInit] = fetchMock.mock.calls[1]
    const reviewBody = JSON.parse(reviewRequestInit.body)
    expect(reviewBody.input[0].content).toContainEqual({
      type: 'input_file',
      filename: 'sachverhalt.pdf',
      file_data: `data:application/pdf;base64,${Buffer.from('PDF bytes').toString('base64')}`
    })
  })

  it('rejects over-limit attachment size before fetching or reading files', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      requestOpenAiCorrection({
        apiKey: 'test-key',
        model: 'gpt-test',
        prompt: 'Korrigiere.',
        attachments: [
          {
            role: 'assignment',
            name: 'zu-gross.pdf',
            absolutePath: '/tmp/zu-gross.pdf',
            mimeType: 'application/pdf',
            size: 50 * 1024 * 1024 + 1
          }
        ]
      })
    ).rejects.toThrow(/KI-Unterlagen sind zu groß/)

    expect(readFileMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws a useful error on non-OK OpenAI responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: vi.fn().mockResolvedValue('rate limit')
      })
    )

    await expect(
      requestOpenAiCorrection({
        apiKey: 'test-key',
        model: 'gpt-test',
        prompt: 'Korrigiere.',
        attachments: []
      })
    ).rejects.toThrow('OpenAI correction request failed (429): rate limit')
  })

  it('tests OpenAI connectivity with a non-stored lightweight request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ output_text: 'OK' })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await requestOpenAiConnectionTest({
      apiKey: 'test-key',
      model: 'gpt-test'
    })

    expect(result).toEqual({
      ok: true,
      model: 'gpt-test',
      message: 'Verbindung erfolgreich.'
    })
    const [, requestInit] = fetchMock.mock.calls[0]
    const body = JSON.parse(requestInit.body)
    expect(body).toMatchObject({
      model: 'gpt-test',
      store: false
    })
    expect(body.input[0].content[0].text).toContain('Verbindungstest')
  })
})

function openAiJsonResponse(overrides: Partial<{ scorePoints: number; scoreReasoning: string }> = {}): Response {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({
      output_text: JSON.stringify({
        scorePoints: overrides.scorePoints ?? 10,
        scoreReasoning: overrides.scoreReasoning ?? 'Ordentliche Schwerpunktsetzung.',
        gradingComment: 'Brauchbare Bearbeitung mit Ausbaupotential.',
        strengths: ['Struktur'],
        weaknesses: ['Subsumtion'],
        tags: ['zivilrecht'],
        confidence: 'medium',
        improvementSuggestions: [],
        inlineComments: []
      })
    })
  } as unknown as Response
}
