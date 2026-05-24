import { describe, expect, it } from 'vitest'
import {
  buildAiCorrectionPrompt,
  extractOpenAiResponseText,
  parseAiCorrectionResponse
} from '@main/services/aiCorrection'

describe('AI correction service', () => {
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
    expect(prompt).toContain('Hauptprobleme')
    expect(prompt).toContain('vertretbar')
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
})
