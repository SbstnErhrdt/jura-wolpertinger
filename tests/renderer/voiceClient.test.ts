import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseRealtimeEvent, parseVoiceCommand, startVoiceClient } from '../../src/renderer/src/voice/voiceClient'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('voice realtime event parser', () => {
  it('parses a valid assessment from completed function-call arguments', () => {
    const parsed = parseRealtimeEvent(JSON.stringify({
      type: 'response.function_call_arguments.done',
      name: 'assess_flashcard_answer',
      arguments: JSON.stringify({
        rating: 3,
        confidence: 'medium',
        reason: 'Die Voraussetzungen wurden richtig benannt.',
        matched_points: ['Voraussetzungen'],
        missed_points: [],
        next_step: 'Pruefe als Naechstes die Rechtsfolge.'
      })
    }))

    expect(parsed?.assessment).toEqual({
      rating: 3,
      confidence: 'medium',
      reason: 'Die Voraussetzungen wurden richtig benannt.',
      matched_points: ['Voraussetzungen'],
      missed_points: [],
      next_step: 'Pruefe als Naechstes die Rechtsfolge.'
    })
  })

  it('keeps input transcript deltas without treating them as an assessment', () => {
    const parsed = parseRealtimeEvent(JSON.stringify({
      type: 'conversation.item.input_audio_transcription.delta',
      delta: 'Die Anspruchsgrundlage ist '
    }))

    expect(parsed).toEqual({ transcript: 'Die Anspruchsgrundlage ist ' })
  })

  it('rejects assistant output transcripts', () => {
    const parsed = parseRealtimeEvent(JSON.stringify({
      type: 'response.output_audio_transcript.delta',
      delta: 'Das ist eine gute Antwort.'
    }))

    expect(parsed?.transcript).toBeUndefined()
  })

  it('rejects incomplete function-call arguments', () => {
    const parsed = parseRealtimeEvent(JSON.stringify({
      type: 'response.function_call_arguments.done',
      arguments: JSON.stringify({ rating: 3, confidence: 'medium' })
    }))

    expect(parsed?.assessment).toBeUndefined()
  })

  it('rejects valid-shaped arguments for a different function name', () => {
    const argumentsJson = JSON.stringify({
      rating: 3,
      confidence: 'medium',
      reason: 'Die Voraussetzungen wurden richtig benannt.',
      matched_points: [],
      missed_points: [],
      next_step: ''
    })

    expect(parseRealtimeEvent(JSON.stringify({
      type: 'response.function_call_arguments.done',
      name: 'unrelated_function',
      arguments: argumentsJson
    }))?.assessment).toBeUndefined()
    expect(parseRealtimeEvent(JSON.stringify({
      type: 'response.output_item.done',
      item: { type: 'function_call', name: 'unrelated_function', arguments: argumentsJson }
    }))?.assessment).toBeUndefined()
  })
})

describe('parseVoiceCommand', () => {
  it('detects next-card commands in German transcripts', () => {
    expect(parseVoiceCommand('nächste Karte bitte')).toBe('next_card')
    expect(parseVoiceCommand('weiter zur nächsten')).toBe('next_card')
    expect(parseVoiceCommand('überspringen')).toBe('next_card')
  })

  it('detects previous-card commands in German transcripts', () => {
    expect(parseVoiceCommand('vorherige Karte')).toBe('previous_card')
    expect(parseVoiceCommand('zurück bitte')).toBe('previous_card')
    expect(parseVoiceCommand('zur letzten Karte')).toBe('previous_card')
  })

  it('detects session ending commands in German transcripts', () => {
    expect(parseVoiceCommand('beenden')).toBe('end_session')
    expect(parseVoiceCommand('Session beenden')).toBe('end_session')
    expect(parseVoiceCommand('Wolpi stopp')).toBe('end_session')
    expect(parseVoiceCommand('abbrechen')).toBe('end_session')
  })

  it('does not treat legal answer text as navigation', () => {
    expect(parseVoiceCommand('Der nächste Prüfungspunkt ist die Begründetheit.')).toBeNull()
    expect(parseVoiceCommand('Zurückbehaltungsrechte wären als Einrede zu prüfen.')).toBeNull()
    expect(parseVoiceCommand('Die Klage ist nach § 253 ZPO zu begründen.')).toBeNull()
  })
})

describe('voice client cancellation', () => {
  it('plays remote audio and asks Wolpi to greet when the data channel opens', async () => {
    const track = { stop: vi.fn() }
    const remoteStream = {} as MediaStream
    const audioElement = {
      autoplay: false,
      srcObject: null as MediaStream | null,
      setAttribute: vi.fn(),
      pause: vi.fn(),
      remove: vi.fn()
    }
    const createElement = vi.fn(() => audioElement)
    vi.stubGlobal('document', { createElement })
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }) }
    })
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
    vi.stubGlobal('MediaStream', vi.fn())
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => 'answer-sdp' }))
    const callbacks = createCallbacks()

    const client = await startVoiceClient({
      clientSecret: 'secret',
      questionText: 'Was ist Verzug?',
      introduce: true,
      firstName: 'Sebastian',
      callbacks
    })
    const connection = FakePeerConnection.instances.at(-1)
    expect(connection).toBeDefined()

    connection?.dispatch('track', { streams: [remoteStream], track: {} })
    connection?.dataChannel.dispatch('open')

    expect(createElement).toHaveBeenCalledWith('audio')
    expect(audioElement.autoplay).toBe(true)
    expect(audioElement.setAttribute).toHaveBeenCalledWith('playsinline', 'true')
    expect(audioElement.srcObject).toBe(remoteStream)
    expect(callbacks.onStatus).toHaveBeenCalledWith('listening')
    expect(connection?.dataChannel.send).toHaveBeenCalledOnce()
    const greeting = JSON.parse(String(connection?.dataChannel.send.mock.calls[0]?.[0])) as {
      type: string
      response: { output_modalities: string[]; instructions: string }
    }
    expect(greeting.type).toBe('response.create')
    expect(greeting.response.output_modalities).toEqual(['audio'])
    expect(greeting.response.instructions).toContain('Hallo Sebastian')
    expect(greeting.response.instructions).toContain('Wolpi')
    expect(greeting.response.instructions).toContain('Sprich ausschließlich Deutsch')
    expect(greeting.response.instructions).toContain('Was ist Verzug?')

    client.stop()
    expect(audioElement.pause).toHaveBeenCalledOnce()
    expect(audioElement.remove).toHaveBeenCalledOnce()
    expect(audioElement.srcObject).toBeNull()
  })

  it('asks the question directly without introduction after the first voice card', async () => {
    const track = { stop: vi.fn() }
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }) }
    })
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => 'answer-sdp' }))

    const client = await startVoiceClient({
      clientSecret: 'secret',
      questionText: 'Was ist Verzug?',
      introduce: false,
      firstName: 'Sebastian',
      callbacks: createCallbacks()
    })
    const connection = FakePeerConnection.instances.at(-1)
    connection?.dataChannel.dispatch('open')

    const greeting = JSON.parse(String(connection?.dataChannel.send.mock.calls[0]?.[0])) as {
      response: { instructions: string }
    }
    expect(greeting.response.instructions).not.toContain('ich bin Wolpi')
    expect(greeting.response.instructions).not.toContain('Hallo Sebastian')
    expect(greeting.response.instructions).toContain('Stelle direkt diese Karteikartenfrage')
    expect(greeting.response.instructions).toContain('Was ist Verzug?')

    client.stop()
  })

  it('emits a next-card command from completed input transcripts', async () => {
    const track = { stop: vi.fn() }
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }) }
    })
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => 'answer-sdp' }))
    const callbacks = createCallbacks()

    const client = await startVoiceClient({
      clientSecret: 'secret',
      questionText: 'Was ist Verzug?',
      callbacks
    })
    const connection = FakePeerConnection.instances.at(-1)
    connection?.dataChannel.dispatch('message', {
      data: JSON.stringify({
        type: 'conversation.item.input_audio_transcription.completed',
        transcript: 'nächste Karte bitte'
      })
    })

    expect(callbacks.onCommand).toHaveBeenCalledWith('next_card')
    expect(callbacks.onTranscript).not.toHaveBeenCalledWith('nächste Karte bitte')

    client.stop()
  })

  it('emits an end-session command from completed input transcripts', async () => {
    const track = { stop: vi.fn() }
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }) }
    })
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => 'answer-sdp' }))
    const callbacks = createCallbacks()

    const client = await startVoiceClient({
      clientSecret: 'secret',
      questionText: 'Was ist Verzug?',
      callbacks
    })
    const connection = FakePeerConnection.instances.at(-1)
    connection?.dataChannel.dispatch('message', {
      data: JSON.stringify({
        type: 'conversation.item.input_audio_transcription.completed',
        transcript: 'Session beenden'
      })
    })

    expect(callbacks.onCommand).toHaveBeenCalledWith('end_session')
    expect(callbacks.onTranscript).not.toHaveBeenCalledWith('Session beenden')

    client.stop()
  })

  it('stops microphone tracks when aborted while media permission is pending', async () => {
    const media = deferred<MediaStream>()
    const track = { stop: vi.fn() }
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(() => media.promise) } })
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
    vi.stubGlobal('fetch', vi.fn())
    const controller = new AbortController()
    const callbacks = createCallbacks()

    const start = startVoiceClient({
      clientSecret: 'secret',
      questionText: 'Was ist Verzug?',
      callbacks,
      signal: controller.signal
    })
    controller.abort()
    media.resolve({ getTracks: () => [track] } as unknown as MediaStream)

    await expect(start).rejects.toThrow('Voice session cancelled')
    expect(track.stop).toHaveBeenCalledOnce()
    expect(callbacks.onError).not.toHaveBeenCalled()
  })

  it('aborts the pending SDP request and closes live resources', async () => {
    const track = { stop: vi.fn() }
    const fetchResponse = deferred<Response>()
    const fetchMock = vi.fn(() => fetchResponse.promise)
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }) }
    })
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()

    const start = startVoiceClient({
      clientSecret: 'secret',
      questionText: 'Was ist Verzug?',
      callbacks: createCallbacks(),
      signal: controller.signal
    })
    await waitForCall(fetchMock)
    controller.abort()
    fetchResponse.resolve({ ok: true, text: async () => 'answer-sdp' } as Response)

    await expect(start).rejects.toThrow('Voice session cancelled')
    const fetchCall = fetchMock.mock.calls[0] as unknown as [RequestInfo, RequestInit]
    expect(fetchCall[1]).toMatchObject({ signal: controller.signal })
    expect(track.stop).toHaveBeenCalledOnce()
    expect(FakePeerConnection.instances.at(-1)?.closed).toBe(true)
    expect(FakePeerConnection.instances.at(-1)?.dataChannel.closed).toBe(true)
  })
})

class FakeDataChannel {
  closed = false
  readyState: RTCDataChannelState = 'connecting'
  readonly listeners = new Map<string, Array<(event: unknown) => void>>()
  readonly send = vi.fn()
  readonly addEventListener = vi.fn((type: string, listener: (event: unknown) => void) => {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  })
  readonly close = vi.fn(() => {
    this.closed = true
    this.readyState = 'closed'
  })

  dispatch(type: string, event: unknown = {}): void {
    if (type === 'open') this.readyState = 'open'
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
}

class FakePeerConnection {
  static instances: FakePeerConnection[] = []
  readonly dataChannel = new FakeDataChannel()
  readonly listeners = new Map<string, Array<(event: unknown) => void>>()
  closed = false
  connectionState: RTCPeerConnectionState = 'new'

  constructor() {
    FakePeerConnection.instances.push(this)
  }

  addEventListener = vi.fn((type: string, listener: (event: unknown) => void) => {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  })
  addTrack = vi.fn()
  createDataChannel = vi.fn(() => this.dataChannel)
  createOffer = vi.fn().mockResolvedValue({ sdp: 'offer-sdp' })
  setLocalDescription = vi.fn().mockResolvedValue(undefined)
  setRemoteDescription = vi.fn().mockResolvedValue(undefined)
  close = vi.fn(() => { this.closed = true })

  dispatch(type: string, event: unknown = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
}

function createCallbacks() {
  return {
    onStatus: vi.fn(),
    onTranscript: vi.fn(),
    onAssessment: vi.fn(),
    onError: vi.fn(),
    onCommand: vi.fn()
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function waitForCall(mock: ReturnType<typeof vi.fn>): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (mock.mock.calls.length > 0) return
    await Promise.resolve()
  }
  throw new Error('Expected function to be called')
}
