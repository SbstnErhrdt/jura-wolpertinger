import { describe, expect, it } from 'vitest'
import { resolveSupabaseUrl } from '@shared/cloudAuthUrl'

describe('cloud auth configuration', () => {
  it('turns relative production API paths into absolute Supabase URLs', () => {
    expect(resolveSupabaseUrl('/api', 'https://app.jura-wolpi.de')).toBe('https://app.jura-wolpi.de/api')
  })

  it('keeps absolute Supabase URLs unchanged', () => {
    expect(resolveSupabaseUrl('https://example.test/api', 'https://app.jura-wolpi.de')).toBe('https://example.test/api')
  })
})
