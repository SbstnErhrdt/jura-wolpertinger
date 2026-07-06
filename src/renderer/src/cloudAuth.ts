import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { resolveSupabaseUrl } from '@shared/cloudAuthUrl'

export type CloudAuthState =
  | { status: 'not_required'; session: null; error: null }
  | { status: 'loading'; session: null; error: null }
  | { status: 'missing_config'; session: null; error: string }
  | { status: 'signed_out'; session: null; error: null }
  | { status: 'signed_in'; session: Session; error: null }

const PRODUCTION_APP_HOST = 'app.jura-wolpi.de'

let authClient: SupabaseClient | null = null

export function requiresCloudAuth(): boolean {
  if (typeof window === 'undefined') return false
  if (window.juraApi) return false
  return window.location?.hostname === PRODUCTION_APP_HOST || import.meta.env.VITE_JURA_REQUIRE_AUTH === '1'
}

export function getSupabaseAuthClient(): SupabaseClient | null {
  if (!requiresCloudAuth()) return null
  if (authClient) return authClient
  const configuredUrl = import.meta.env.VITE_SUPABASE_URL
  const url = resolveSupabaseUrl(configuredUrl, window.location.origin)
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!anonKey) return null
  authClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  })
  return authClient
}

export async function readCloudAuthState(): Promise<CloudAuthState> {
  if (!requiresCloudAuth()) return { status: 'not_required', session: null, error: null }
  const client = getSupabaseAuthClient()
  if (!client) {
    return {
      status: 'missing_config',
      session: null,
      error: 'Die Anmeldung ist gerade nicht eingerichtet. Bitte versuche es später erneut.'
    }
  }
  const { data, error } = await client.auth.getSession()
  if (error) return { status: 'signed_out', session: null, error: null }
  if (!data.session) return { status: 'signed_out', session: null, error: null }
  return { status: 'signed_in', session: data.session, error: null }
}
