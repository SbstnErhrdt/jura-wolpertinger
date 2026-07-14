import type {
  VoiceSessionCompleteInput,
  VoiceSessionCompleteResult,
  VoiceSessionStart,
  VoiceSessionStartInput
} from '@shared/ipc'
import { getVoiceSupabaseAuthClient } from '../cloudAuth'

async function authHeaders(): Promise<HeadersInit> {
  const client = getVoiceSupabaseAuthClient()
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

export async function completeVoiceReviewSession(
  input: VoiceSessionCompleteInput
): Promise<VoiceSessionCompleteResult> {
  const response = await fetch(`/voice/sessions/${input.sessionId}/complete`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ transcript: input.transcript, assessment: input.assessment })
  })
  if (!response.ok) throw new Error('Voice-Bewertung konnte nicht gespeichert werden.')
  return response.json() as Promise<VoiceSessionCompleteResult>
}
