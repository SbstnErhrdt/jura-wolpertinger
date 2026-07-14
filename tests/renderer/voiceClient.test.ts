import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseRealtimeEvent, startVoiceClient } from '../../src/renderer/src/voice/voiceClient'

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

  it('keeps transcript deltas without treating arbitrary event data as an assessment', () => {
    const parsed = parseRealtimeEvent(JSON.stringify({
      type: 'response.output_audio_transcript.delta',
      delta: 'Die Anspruchsgrundlage ist '
    }))

    expect(parsed).toEqual({ transcript: 'Die Anspruchsgrundlage ist ' })
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

describe('voice client cancellation', () => {
  it('stops microphone tracks when aborted while media permission is pending', async () => {
    const media = deferred<MediaStream>()
    const track = { stop: vi.fn() }
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(() => media.promise) } })
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
    vi.stubGlobal('fetch', vi.fn())
    const controller = new AbortController()
    const callbacks = createCallbacks()

    const start = startVoiceClient({ clientSecret: 'secret', callbacks, signal: controller.signal })
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

    const start = startVoiceClient({ clientSecret: 'secret', callbacks: createCallbacks(), signal: controller.signal })
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

class FakePeerConnection {
  static instances: FakePeerConnection[] = []
  readonly dataChannel = { closed: false, addEventListener: vi.fn(), close: () => { this.dataChannel.closed = true } }
  closed = false
  connectionState: RTCPeerConnectionState = 'new'

  constructor() {
    FakePeerConnection.instances.push(this)
  }

  addEventListener = vi.fn()
  addTrack = vi.fn()
  createDataChannel = vi.fn(() => this.dataChannel)
  createOffer = vi.fn().mockResolvedValue({ sdp: 'offer-sdp' })
  setLocalDescription = vi.fn().mockResolvedValue(undefined)
  setRemoteDescription = vi.fn().mockResolvedValue(undefined)
  close = vi.fn(() => { this.closed = true })
}

function createCallbacks() {
  return {
    onStatus: vi.fn(),
    onTranscript: vi.fn(),
    onAssessment: vi.fn(),
    onError: vi.fn()
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
