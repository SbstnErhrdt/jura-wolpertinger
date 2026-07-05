import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const rendererDir = join(process.cwd(), 'out', 'renderer')
const indexHtml = await readFile(join(rendererDir, 'index.html'), 'utf8')
const match = indexHtml.match(/assets\/(index-[^"']+\.js)/)

if (!match) {
  console.error('Production-Web-Build enthaelt keinen Renderer-JavaScript-Bundle.')
  process.exit(1)
}

const bundlePath = join(rendererDir, 'assets', match[1])
const bundle = await readFile(bundlePath, 'utf8')
const authFunction = bundle.match(/function getSupabaseAuthClient\(\) \{[\s\S]*?async function readCloudAuthState/)

if (!authFunction) {
  console.error('Production-Web-Build enthaelt keinen erkennbaren Supabase Auth-Client.')
  process.exit(1)
}

if (!authFunction[0].includes('createClient(')) {
  console.error('Production-Web-Build enthaelt keinen konfigurierten Supabase Auth-Client.')
  process.exit(1)
}

const assets = await readdir(join(rendererDir, 'assets'))
const hasCss = assets.some((asset) => /^index-.*\.css$/.test(asset))
if (!hasCss) {
  console.error('Production-Web-Build enthaelt keinen CSS-Bundle.')
  process.exit(1)
}
