import type { AppApi } from '@shared/ipc'

declare global {
  interface ImportMetaEnv {
    readonly PACKAGE_VERSION: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }

  interface Window {
    juraApi?: AppApi
  }
}

export {}
