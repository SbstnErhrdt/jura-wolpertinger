import { cp, mkdir, rm } from 'node:fs/promises'
import { promisify } from 'node:util'
import { execFile as execFileCallback } from 'node:child_process'
import { join } from 'node:path'
import { platform } from 'node:process'

const execFile = promisify(execFileCallback)

const rootDir = process.cwd()
const sourceIconPath = join(rootDir, 'assets', 'icon.png')
const buildDir = join(rootDir, 'build')
const iconSetDir = join(buildDir, 'icon.iconset')
const outputPngPath = join(buildDir, 'icon.png')
const outputIcnsPath = join(buildDir, 'icon.icns')
const rendererIconPath = join(rootDir, 'src', 'renderer', 'public', 'assets', 'icon.png')

await mkdir(buildDir, { recursive: true })
await preparePngIcon()
await cp(outputPngPath, rendererIconPath)

if (platform !== 'darwin') {
  console.log(`Prepared ${outputPngPath}`)
  process.exit(0)
}

await rm(iconSetDir, { recursive: true, force: true })
await mkdir(iconSetDir, { recursive: true })

const sizes = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024]
]

for (const [fileName, size] of sizes) {
  await execFile('sips', ['-z', String(size), String(size), outputPngPath, '--out', join(iconSetDir, fileName)])
}

await execFile('iconutil', ['-c', 'icns', iconSetDir, '-o', outputIcnsPath])

console.log(`Prepared ${outputPngPath}`)
console.log(`Prepared ${outputIcnsPath}`)

async function preparePngIcon() {
  try {
    const { stdout } = await execFile('magick', ['identify', '-format', '%w %h', sourceIconPath])
    const [width, height] = stdout
      .trim()
      .split(/\s+/)
      .map((value) => Number.parseInt(value, 10))

    await execFile('magick', [
      sourceIconPath,
      '-alpha',
      'set',
      '-channel',
      'rgba',
      '-fuzz',
      '5%',
      '-fill',
      'none',
      '-draw',
      'color 0,0 floodfill',
      '-draw',
      `color ${width - 1},0 floodfill`,
      '-draw',
      `color 0,${height - 1} floodfill`,
      '-draw',
      `color ${width - 1},${height - 1} floodfill`,
      '-trim',
      '+repage',
      '-resize',
      '1024x1024^',
      '-gravity',
      'center',
      '-background',
      'none',
      '-extent',
      '1024x1024',
      outputPngPath
    ])
  } catch {
    await cp(sourceIconPath, outputPngPath)
  }
}
