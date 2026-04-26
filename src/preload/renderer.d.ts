import type { AppApi } from '@shared/ipc'

declare global {
  interface Window {
    juraApi?: AppApi
  }
}

export {}
