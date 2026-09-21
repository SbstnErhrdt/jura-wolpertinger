import { inflateSync } from 'node:zlib'
import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const assetsRoot = resolve(process.cwd(), 'website/static/assets/wolpi')
const files = ['hero.png', 'cards.png', 'desktop.png']
const screenshotsRoot = resolve(process.cwd(), 'website/static/screenshots')
const screenshots = [
  '1_home.png',
  '2_karteikarten.png',
  '3_podcasts.png',
  '4_wiederholen.png',
  '5_pruefungen.png',
  '6_statistik.png'
]

describe('website artwork assets', () => {
  it.each(files)('%s is a real transparent and web-sized PNG', async (file) => {
    const path = resolve(assetsRoot, file)
    const data = await readFile(path)
    const metadata = pngMetadata(data)

    expect(metadata.width).toBeLessThanOrEqual(1024)
    expect(metadata.height).toBeLessThanOrEqual(1024)
    expect(metadata.hasTransparentPixel).toBe(true)
    expect((await stat(path)).size).toBeLessThan(750_000)
  })

  it.each(screenshots)('%s is a consistent optimized product screenshot', async (file) => {
    const path = resolve(screenshotsRoot, file)
    const metadata = pngMetadata(await readFile(path))

    expect(metadata.width).toBe(1440)
    expect(metadata.height).toBe(960)
    expect((await stat(path)).size).toBeLessThan(900_000)
  })
})

function pngMetadata(data: Buffer): { width: number; height: number; hasTransparentPixel: boolean } {
  expect(data.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  const idat: Buffer[] = []
  let paletteTransparency: Buffer | null = null

  while (offset < data.length) {
    const length = data.readUInt32BE(offset)
    const type = data.subarray(offset + 4, offset + 8).toString('ascii')
    const chunk = data.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0)
      height = chunk.readUInt32BE(4)
      bitDepth = chunk[8]
      colorType = chunk[9]
      interlace = chunk[12]
    } else if (type === 'IDAT') idat.push(chunk)
    else if (type === 'tRNS') paletteTransparency = chunk
    offset += length + 12
  }

  if (colorType === 3) {
    return {
      width,
      height,
      hasTransparentPixel: Boolean(paletteTransparency?.some((alpha) => alpha < 255))
    }
  }
  if (colorType === 2) return { width, height, hasTransparentPixel: false }
  expect(bitDepth).toBe(8)
  expect(interlace).toBe(0)
  expect([4, 6]).toContain(colorType)
  const bytesPerPixel = colorType === 6 ? 4 : 2
  const stride = width * bytesPerPixel
  const inflated = inflateSync(Buffer.concat(idat))
  let previous = Buffer.alloc(stride)
  let hasTransparentPixel = false
  let cursor = 0
  for (let row = 0; row < height; row += 1) {
    const filter = inflated[cursor++]
    const scanline = Buffer.from(inflated.subarray(cursor, cursor + stride))
    cursor += stride
    for (let index = 0; index < stride; index += 1) {
      const left = index >= bytesPerPixel ? scanline[index - bytesPerPixel] : 0
      const up = previous[index]
      const upLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel] : 0
      if (filter === 1) scanline[index] = (scanline[index] + left) & 255
      else if (filter === 2) scanline[index] = (scanline[index] + up) & 255
      else if (filter === 3) scanline[index] = (scanline[index] + Math.floor((left + up) / 2)) & 255
      else if (filter === 4) scanline[index] = (scanline[index] + paeth(left, up, upLeft)) & 255
    }
    for (let index = bytesPerPixel - 1; index < stride; index += bytesPerPixel) {
      if (scanline[index] < 255) hasTransparentPixel = true
    }
    previous = scanline
  }
  return { width, height, hasTransparentPixel }
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft
  const leftDistance = Math.abs(estimate - left)
  const upDistance = Math.abs(estimate - up)
  const upLeftDistance = Math.abs(estimate - upLeft)
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left
  return upDistance <= upLeftDistance ? up : upLeft
}
