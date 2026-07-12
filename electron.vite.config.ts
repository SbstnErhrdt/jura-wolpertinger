import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import ui from '@nuxt/ui/vite'
import { NuxtIconBundle } from '@nuxt/icon/vite'
import type { Plugin } from 'vite'

const rendererAssets = [
  {
    source: resolve('assets', 'submission.png'),
    target: resolve('src/renderer', 'public', 'assets', 'submission.png')
  },
  {
    source: resolve('assets', 'hello.png'),
    target: resolve('src/renderer', 'public', 'assets', 'hello.png')
  }
]
function syncRendererAssets(): void {
  for (const asset of rendererAssets) {
    if (!existsSync(asset.source)) continue
    mkdirSync(dirname(asset.target), { recursive: true })
    copyFileSync(asset.source, asset.target)
  }
}

function syncRendererAssetsPlugin(): Plugin {
  return {
    name: 'sync-renderer-assets',
    buildStart() {
      syncRendererAssets()
    },
    configureServer(server) {
      syncRendererAssets()
      server.watcher.add(rendererAssets.map((asset) => asset.source))

      const handleAssetUpdate = (file: string) => {
        if (!rendererAssets.some((asset) => resolve(file) === asset.source)) return
        syncRendererAssets()
        server.ws.send({ type: 'full-reload' })
      }

      server.watcher.on('add', handleAssetUpdate)
      server.watcher.on('change', handleAssetUpdate)
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@main': resolve('src/main')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    root: resolve('src/renderer'),
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [
      vue(),
      ui({
        colorMode: false,
        ui: {
          colors: {
            primary: 'wolpi',
            secondary: 'sky',
            neutral: 'slate'
          }
        }
      }),
      NuxtIconBundle({
        scan: true,
        icons: [
          'lucide:check',
          'lucide:chevron-down',
          'lucide:chevron-left',
          'lucide:chevron-right',
          'lucide:chevrons-left',
          'lucide:chevrons-right',
          'lucide:ellipsis',
          'lucide:loader-circle',
          'lucide:minus',
          'lucide:pencil',
          'lucide:plus',
          'lucide:search',
          'lucide:x'
        ]
      }),
      syncRendererAssetsPlugin()
    ]
  }
})
