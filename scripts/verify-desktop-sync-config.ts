import { readDesktopSyncBuildConfig, requireDesktopSyncBuildConfig } from './desktop-sync-build-config'

try {
  requireDesktopSyncBuildConfig(readDesktopSyncBuildConfig())
  console.log('Desktop-Sync-Konfiguration ist für den Release-Build vorhanden.')
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
