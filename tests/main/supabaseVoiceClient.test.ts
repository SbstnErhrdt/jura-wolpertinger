import { afterEach, describe, expect, it, vi } from 'vitest'
import { SupabaseSyncClient } from '@main/services/supabaseSyncClient'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SupabaseSyncClient Voice API', () => {
  it('uses the connected online session and absolute app URL for Voice sessions', async () => {
    const client = createVoiceClient('https://app.example.test/api')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({
        sessionId: 'session-1',
        clientSecret: 'secret',
        model: 'gpt-realtime',
        voice: 'alloy'
      }))
      .mockResolvedValueOnce(jsonResponse({
        assessment: {
          rating: 3,
          confidence: 'medium',
          reason: 'Gut begruendet.',
          matchedPoints: [],
          missedPoints: [],
          nextStep: 'Weiterlernen.'
        },
        recorded: true,
        reviewEventId: 'event-1'
      }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(client.createVoiceReviewSession({ promptId: 'prompt-1' })).resolves.toEqual({
      sessionId: 'session-1',
      clientSecret: 'secret',
      model: 'gpt-realtime',
      voice: 'alloy'
    })
    await client.completeVoiceReviewSession({
      sessionId: 'session-1',
      transcript: 'Meine Antwort',
      assessment: { rating: 3 }
    })

    expect(fetchMock).toHaveBeenCalledWith('https://app.example.test/voice/sessions', {
      method: 'POST',
      headers: {
        authorization: 'Bearer access-token',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ promptId: 'prompt-1' })
    })
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://app.example.test/voice/sessions/session-1/complete',
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer access-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify({ transcript: 'Meine Antwort', assessment: { rating: 3 } })
      }
    )
  })

  it('requires an existing online connection before starting Voice', async () => {
    const client = createVoiceClient('https://app.example.test/api', null)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(client.createVoiceReviewSession({ promptId: 'prompt-1' })).rejects.toThrow(
      'Bitte verbinde dein Online-Konto, um Voice zu nutzen.'
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

function createVoiceClient(syncUrl: string, accessToken: string | null = 'access-token'): SupabaseSyncClient {
  const client = new SupabaseSyncClient(syncUrl, 'anon-key')
  const internal = client as unknown as {
    client: {
      auth: { getSession: () => Promise<{ data: { session: { access_token: string } | null } }> }
    }
  }
  internal.client = {
    auth: {
      getSession: async () => ({ data: { session: accessToken ? { access_token: accessToken } : null } })
    }
  }
  return client
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}
