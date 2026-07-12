export function resolveSupabaseUrl(configuredUrl: string | undefined, origin: string): string {
  const url = configuredUrl || '/api'
  if (/^https?:\/\//.test(url)) return url
  return new URL(url.startsWith('/') ? url : `/${url}`, origin).toString()
}
