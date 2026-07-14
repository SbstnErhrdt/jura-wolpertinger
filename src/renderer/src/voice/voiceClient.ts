export type VoiceClientStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'prompting'
  | 'assessing'
  | 'result'
  | 'uncertain'
  | 'error'

export type VoiceClientCallbacks = {
  onStatus(status: VoiceClientStatus): void
  onTranscript(transcript: string): void
  onAssessment(assessment: VoiceAssessment): void
  onError(message: string): void
}

export type VoiceClient = {
  stop(): void
}

export type VoiceAssessment = {
  rating: 1 | 2 | 3 | 4
  confidence: 'low' | 'medium' | 'high'
  reason: string
  matched_points: string[]
  missed_points: string[]
  next_step: string
}

type RealtimeEvent = {
  type?: string
  name?: string
  transcript?: string
  delta?: string
  arguments?: string
  item?: unknown
}

export type ParsedRealtimeEvent = {
  assessment?: VoiceAssessment
  status?: 'prompting' | 'assessing'
  transcript?: string
  replaceTranscript?: true
}

export function parseRealtimeEvent(input: string): ParsedRealtimeEvent | null {
  let payload: RealtimeEvent
  try {
    payload = JSON.parse(input) as RealtimeEvent
  } catch {
    return null
  }

  if (!payload || typeof payload !== 'object' || typeof payload.type !== 'string') return null
  const parsed: ParsedRealtimeEvent = {}
  if (payload.type.includes('response.created')) parsed.status = 'prompting'

  const isInputTranscript = payload.type === 'conversation.item.input_audio_transcription.delta'
    || payload.type === 'conversation.item.input_audio_transcription.completed'
  const transcript = payload.transcript ?? payload.delta
  if (isInputTranscript && transcript) {
    parsed.transcript = transcript
    if (payload.transcript) parsed.replaceTranscript = true
  }

  const assessment = parseFunctionCallAssessment(payload)
  if (assessment) {
    parsed.assessment = assessment
    parsed.status = 'assessing'
  }

  return parsed
}

function parseFunctionCallAssessment(payload: RealtimeEvent): VoiceAssessment | null {
  let argumentsJson: unknown
  if (payload.type === 'response.function_call_arguments.done') {
    if (payload.name !== 'assess_flashcard_answer') return null
    argumentsJson = payload.arguments
  } else if (payload.type === 'response.output_item.done') {
    const item = payload.item
    if (!isRecord(item) || item.type !== 'function_call' || item.name !== 'assess_flashcard_answer') return null
    argumentsJson = item.arguments
  } else {
    return null
  }
  if (typeof argumentsJson !== 'string') return null

  try {
    return parseVoiceAssessment(JSON.parse(argumentsJson))
  } catch {
    return null
  }
}

function parseVoiceAssessment(value: unknown): VoiceAssessment | null {
  if (!isRecord(value)) return null
  if (![1, 2, 3, 4].includes(value.rating as number)) return null
  if (value.confidence !== 'low' && value.confidence !== 'medium' && value.confidence !== 'high') return null
  if (typeof value.reason !== 'string' || !value.reason.trim()) return null
  if (!isStringArray(value.matched_points) || !isStringArray(value.missed_points)) return null
  if (typeof value.next_step !== 'string') return null

  return {
    rating: value.rating as VoiceAssessment['rating'],
    confidence: value.confidence,
    reason: value.reason,
    matched_points: value.matched_points,
    missed_points: value.missed_points,
    next_step: value.next_step
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

export async function startVoiceClient(input: {
  clientSecret: string
  callbacks: VoiceClientCallbacks
  signal?: AbortSignal
}): Promise<VoiceClient> {
  if (input.signal?.aborted) throw cancellationError()
  if (!navigator.mediaDevices?.getUserMedia) {
    input.callbacks.onError('Dein Gerät unterstützt keine Sprachaufnahme. Du kannst die Karte manuell wiederholen.')
    throw new Error('Audio capture is not available')
  }

  let stream: MediaStream | null = null
  let peerConnection: RTCPeerConnection | null = null
  let dataChannel: RTCDataChannel | null = null
  let stopped = false
  let transcript = ''
  const canNotify = (): boolean => !stopped && !input.signal?.aborted
  const notifyStatus = (status: VoiceClientStatus): void => {
    if (canNotify()) input.callbacks.onStatus(status)
  }
  const notifyTranscript = (value: string): void => {
    if (canNotify()) input.callbacks.onTranscript(value)
  }
  const notifyAssessment = (assessment: VoiceAssessment): void => {
    if (canNotify()) input.callbacks.onAssessment(assessment)
  }
  const notifyError = (message: string): void => {
    if (canNotify()) input.callbacks.onError(message)
  }

  const stop = (): void => {
    if (stopped) return
    stopped = true
    dataChannel?.close()
    peerConnection?.close()
    stream?.getTracks().forEach((track) => track.stop())
    input.signal?.removeEventListener('abort', stop)
  }

  input.signal?.addEventListener('abort', stop, { once: true })
  notifyStatus('connecting')

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    if (stopped) {
      stream.getTracks().forEach((track) => track.stop())
      throw cancellationError()
    }
    peerConnection = new RTCPeerConnection()
    stream.getTracks().forEach((track) => peerConnection?.addTrack(track, stream as MediaStream))
    dataChannel = peerConnection.createDataChannel('oai-events')
    dataChannel.addEventListener('open', () => notifyStatus('listening'))
    dataChannel.addEventListener('message', (event) => {
      const parsed = parseRealtimeEvent(String(event.data))
      if (!parsed) return
      if (parsed.status) notifyStatus(parsed.status)
      if (parsed.assessment) notifyAssessment(parsed.assessment)
      if (!parsed.transcript) return
      transcript = parsed.replaceTranscript ? parsed.transcript : `${transcript}${parsed.transcript}`
      notifyTranscript(transcript)
    })
    peerConnection.addEventListener('connectionstatechange', () => {
      if (peerConnection?.connectionState === 'failed') {
        notifyError('Das Gespräch wurde unterbrochen. Du kannst die Karte manuell wiederholen.')
        stop()
      }
    })

    const offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)
    const response = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${input.clientSecret}`,
        'content-type': 'application/sdp'
      },
      body: offer.sdp,
      signal: input.signal
    })
    if (stopped) throw cancellationError()
    if (!response.ok) throw new Error(`Realtime SDP request failed: ${response.status}`)
    const sdp = await response.text()
    if (!sdp) throw new Error('Realtime SDP response is empty')
    await peerConnection.setRemoteDescription({ type: 'answer', sdp })
    if (stopped) throw cancellationError()

    return { stop }
  } catch (error) {
    const cancelled = stopped || input.signal?.aborted
    stop()
    if (cancelled) throw cancellationError()
    notifyError('Das Gespräch konnte nicht gestartet werden. Du kannst die Karte manuell wiederholen.')
    throw error
  }
}

function cancellationError(): Error {
  return new Error('Voice session cancelled')
}
