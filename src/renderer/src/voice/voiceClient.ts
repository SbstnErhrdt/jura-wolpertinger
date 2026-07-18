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
  onCommand?(command: VoiceCommand): void
}

export type VoiceClient = {
  stop(): void
}

export type VoiceCommand = 'next_card' | 'previous_card' | 'end_session'

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

export function parseVoiceCommand(transcript: string): VoiceCommand | null {
  const normalized = normalizeCommandText(transcript)
  if (!normalized) return null

  const nextPhrases = [
    'weiter',
    'weiter bitte',
    'naechste',
    'naechste bitte',
    'naechste karte',
    'naechste karte bitte',
    'weiter zur naechsten',
    'weiter zur naechsten karte',
    'karte ueberspringen',
    'ueberspringen',
    'ueberspringen bitte'
  ]
  if (nextPhrases.includes(normalized)) return 'next_card'
  if (/\bnaechste karte\b/.test(normalized)) return 'next_card'
  if (/\bweiter zur naechsten( karte)?\b/.test(normalized)) return 'next_card'

  const previousPhrases = [
    'zurueck',
    'zurueck bitte',
    'vorherige',
    'vorherige bitte',
    'vorherige karte',
    'vorherige karte bitte',
    'letzte karte',
    'zur letzten karte',
    'eine karte zurueck'
  ]
  if (previousPhrases.includes(normalized)) return 'previous_card'
  if (/\bvorherige karte\b/.test(normalized)) return 'previous_card'
  if (/\bzur letzten karte\b/.test(normalized)) return 'previous_card'
  if (/\beine karte zurueck\b/.test(normalized)) return 'previous_card'

  const endPhrases = [
    'beenden',
    'session beenden',
    'sprachrunde beenden',
    'gespraech beenden',
    'wolpi stopp',
    'wolpi stop',
    'stopp wolpi',
    'stop wolpi',
    'abbrechen',
    'voice beenden',
    'sprache beenden'
  ]
  if (endPhrases.includes(normalized)) return 'end_session'
  if (/\b(session|sprachrunde|gespraech|voice|sprache) beenden\b/.test(normalized)) return 'end_session'
  if (/\bwolpi sto+p\b/.test(normalized)) return 'end_session'

  return null
}

function normalizeCommandText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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
  questionText: string
  introduce?: boolean
  firstName?: string | null
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
  let remoteAudioElement: HTMLAudioElement | null = null
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
  const notifyCommand = (command: VoiceCommand): void => {
    if (canNotify()) input.callbacks.onCommand?.(command)
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
    if (remoteAudioElement) {
      remoteAudioElement.pause()
      remoteAudioElement.srcObject = null
      remoteAudioElement.remove()
      remoteAudioElement = null
    }
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
    peerConnection.addEventListener('track', (event) => {
      if (!remoteAudioElement) {
        remoteAudioElement = document.createElement('audio')
        remoteAudioElement.autoplay = true
        remoteAudioElement.setAttribute('playsinline', 'true')
      }
      remoteAudioElement.srcObject = event.streams[0] ?? new MediaStream([event.track])
    })
    stream.getTracks().forEach((track) => peerConnection?.addTrack(track, stream as MediaStream))
    dataChannel = peerConnection.createDataChannel('oai-events')
    dataChannel.addEventListener('open', () => {
      notifyStatus('listening')
      sendGreetingResponse(dataChannel as RTCDataChannel, {
        questionText: input.questionText,
        introduce: input.introduce ?? true,
        firstName: input.firstName ?? null
      })
    })
    dataChannel.addEventListener('message', (event) => {
      const parsed = parseRealtimeEvent(String(event.data))
      if (!parsed) return
      if (parsed.status) notifyStatus(parsed.status)
      if (parsed.assessment) notifyAssessment(parsed.assessment)
      if (!parsed.transcript) return
      if (parsed.replaceTranscript) {
        const command = parseVoiceCommand(parsed.transcript)
        if (command) {
          notifyCommand(command)
          return
        }
      }
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

function sendGreetingResponse(
  dataChannel: RTCDataChannel,
  input: { questionText: string; introduce: boolean; firstName: string | null }
): void {
  if (dataChannel.readyState !== 'open') return
  const normalizedQuestion = input.questionText.trim()
  const normalizedFirstName = input.firstName?.trim()
  const introduction = normalizedFirstName
    ? `Hallo ${normalizedFirstName}, ich bin Wolpi.`
    : 'Hallo, ich bin Wolpi.'
  dataChannel.send(JSON.stringify({
    type: 'response.create',
    response: {
      output_modalities: ['audio'],
      instructions: [
        'Sprich ausschließlich Deutsch.',
        input.introduce
          ? `${introduction} Ich begleite dich kurz durch diese Karte.`
          : 'Stelle direkt diese Karteikartenfrage.',
        input.introduce ? 'Stelle dann genau diese Karteikartenfrage:' : '',
        normalizedQuestion,
        'Sage danach: "Nimm dir ruhig einen Moment Zeit und formuliere deine Antwort laut."',
        'Lass kurze Denkpausen zu und antworte nicht sofort, wenn der Lernende noch überlegt.',
        'Bleib knapp, freundlich und auf Deutsch. Verrate die Musterantwort nicht.'
      ].filter(Boolean).join(' ')
    }
  }))
}

function cancellationError(): Error {
  return new Error('Voice session cancelled')
}
