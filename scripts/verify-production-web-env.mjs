const required = ['VITE_JURA_REQUIRE_AUTH', 'VITE_SUPABASE_ANON_KEY']

for (const name of required) {
  if (!process.env[name]) {
    console.error(`${name} fehlt. Production-Web-Build braucht Supabase Auth-Konfiguration.`)
    process.exit(1)
  }
}

if (process.env.VITE_JURA_REQUIRE_AUTH !== '1') {
  console.error('VITE_JURA_REQUIRE_AUTH muss fuer den Production-Web-Build auf 1 stehen.')
  process.exit(1)
}

const configuredUrl = process.env.VITE_SUPABASE_URL
if (configuredUrl && !/^https?:\/\//.test(configuredUrl) && !configuredUrl.startsWith('/')) {
  console.error('VITE_SUPABASE_URL muss eine absolute URL oder ein Root-Pfad sein.')
  process.exit(1)
}
