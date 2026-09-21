type AppWindowEnvironment = {
  JURA_E2E?: string
  JURA_E2E_SHOW?: string
}

export function shouldShowAppWindows(env: AppWindowEnvironment): boolean {
  return env.JURA_E2E !== '1' || env.JURA_E2E_SHOW === '1'
}
