import { RELEASE_SMOKE_ENV, RELEASE_SMOKE_MARKER } from '@shared/releaseSmoke'

export function handleReleaseSmokeRendererReady(input: {
  env: Record<string, string | undefined>
  writeMarker: (marker: string) => void
  quit: () => void
}) {
  if (input.env[RELEASE_SMOKE_ENV] !== '1') {
    return false
  }

  input.writeMarker(RELEASE_SMOKE_MARKER)
  input.quit()
  return true
}
