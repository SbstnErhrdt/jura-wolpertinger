export type AiConnectionTestSource = 'active' | 'environment'

export function aiConnectionFallbackMessage(source: AiConnectionTestSource): string {
  const prefix = source === 'environment' ? '.env-Verbindungstest' : 'Verbindungstest'
  return `${prefix} konnte nicht gestartet werden. Bitte App komplett neu starten, damit Main und Preload aktualisiert sind.`
}
