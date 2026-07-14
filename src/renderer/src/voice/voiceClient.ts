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
  onAssessment(assessment: unknown): void
  onError(message: string): void
}

export type VoiceClient = {
  stop(): void
}

type RealtimeEvent = {
  type?: string
  transcript?: string
  delta?: string
  assessment?: unknown
}

export async function startVoiceClient(input: {
  clientSecret: string
  callbacks: VoiceClientCallbacks
}): Promise<VoiceClient> {
  if (!navigator.mediaDevices?.getUserMedia) {
    input.callbacks.onError('Dein Gerät unterstützt keine Sprachaufnahme. Du kannst die Karte manuell wiederholen.')
    throw new Error('Audio capture is not available')
  }

  input.callbacks.onStatus('connecting')
  let stream: MediaStream | null = null
  let peerConnection: RTCPeerConnection | null = null
  let dataChannel: RTCDataChannel | null = null
  let stopped = false
  let transcript = ''

  const stop = (): void => {
    if (stopped) return
    stopped = true
    dataChannel?.close()
    peerConnection?.close()
    stream?.getTracks().forEach((track) => track.stop())
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    peerConnection = new RTCPeerConnection()
    stream.getTracks().forEach((track) => peerConnection?.addTrack(track, stream as MediaStream))
    dataChannel = peerConnection.createDataChannel('oai-events')
    dataChannel.addEventListener('open', () => input.callbacks.onStatus('listening'))
    dataChannel.addEventListener('message', (event) => {
      let payload: RealtimeEvent
      try {
        payload = JSON.parse(String(event.data)) as RealtimeEvent
      } catch {
        return
      }

      if (payload.type?.includes('response.created')) input.callbacks.onStatus('prompting')
      if (payload.type?.includes('assessment')) input.callbacks.onStatus('assessing')
      if (payload.assessment !== undefined) input.callbacks.onAssessment(payload.assessment)

      const nextTranscript = payload.transcript ?? payload.delta
      if (!payload.type?.includes('transcript') || !nextTranscript) return
      transcript = payload.transcript ?? `${transcript}${nextTranscript}`
      input.callbacks.onTranscript(transcript)
    })
    peerConnection.addEventListener('connectionstatechange', () => {
      if (peerConnection?.connectionState === 'failed') {
        input.callbacks.onError('Das Gespräch wurde unterbrochen. Du kannst die Karte manuell wiederholen.')
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
      body: offer.sdp
    })
    if (!response.ok) throw new Error(`Realtime SDP request failed: ${response.status}`)
    const sdp = await response.text()
    if (!sdp) throw new Error('Realtime SDP response is empty')
    await peerConnection.setRemoteDescription({ type: 'answer', sdp })

    return { stop }
  } catch (error) {
    stop()
    input.callbacks.onError('Das Gespräch konnte nicht gestartet werden. Du kannst die Karte manuell wiederholen.')
    throw error
  }
}
