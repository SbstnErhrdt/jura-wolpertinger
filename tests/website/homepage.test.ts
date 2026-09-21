import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = process.cwd()
const homepagePath = resolve(projectRoot, 'website/layouts/index.html')

describe('public website homepage', () => {
  it('presents podcasts and semantic learning progress as product features', async () => {
    const homepage = await readFile(homepagePath, 'utf8')

    expect(homepage).toContain('<h3>Podcasts</h3>')
    expect(homepage).toContain('Nicht gewusst, teilweise gewusst und gewusst')
  })

  it('uses the current screenshot set with meaningful captions', async () => {
    const homepage = await readFile(homepagePath, 'utf8')

    for (const screenshot of [
      '1_home.png',
      '2_karteikarten.png',
      '3_podcasts.png',
      '4_wiederholen.png',
      '5_pruefungen.png',
      '6_statistik.png'
    ]) {
      expect(homepage).toContain(`resources.Get "images/screenshots/${screenshot}" | fingerprint`)
    }
    expect(homepage).not.toContain('src="/screenshots/')
  })

  it('prioritizes the hero image and lazy-loads images below the fold', async () => {
    const homepage = await readFile(homepagePath, 'utf8')

    expect(homepage).toMatch(/\$homeScreenshot\.RelPermalink[^>]+fetchpriority="high"/)
    expect(homepage).toMatch(/\$cardsWolpi\.RelPermalink[^>]+loading="lazy"/)
    expect(homepage).toMatch(/\$podcastsScreenshot\.RelPermalink[^>]+loading="lazy"/)
    expect(homepage).toMatch(/\$desktopWolpi\.RelPermalink[^>]+loading="lazy"/)
  })

  it('fingerprints every public artwork URL instead of reusing immutable legacy paths', async () => {
    const homepage = await readFile(homepagePath, 'utf8')

    for (const artwork of [
      'images/wolpi/hero.png',
      'images/wolpi/cards.png',
      'images/wolpi/desktop.png'
    ]) {
      expect(homepage).toContain(`resources.Get "${artwork}" | fingerprint`)
    }
    expect(homepage).not.toContain('/assets/wolpi/')
  })

  it('uses the same real Linux artwork instead of a diamond on every download page', async () => {
    const templatePaths = [
      homepagePath,
      resolve(projectRoot, 'website/layouts/_default/download.html'),
      resolve(projectRoot, 'website/layouts/_default/installation.html')
    ]

    for (const templatePath of templatePaths) {
      const template = await readFile(templatePath, 'utf8')
      expect(template).toContain('resources.Get "images/platforms/linux.svg" | fingerprint')
      expect(template).toContain('src="{{ $linuxIcon.RelPermalink }}"')
      expect(template).not.toContain('>◆<')
    }
  })

  it('ships fingerprinted artwork URLs in the committed website build', async () => {
    const [homepage, downloadPage, installationPage] = await Promise.all([
      readFile(resolve(projectRoot, 'docs/index.html'), 'utf8'),
      readFile(resolve(projectRoot, 'docs/download/index.html'), 'utf8'),
      readFile(resolve(projectRoot, 'docs/installation/index.html'), 'utf8')
    ])

    expect(homepage).toMatch(/\/images\/wolpi\/hero\.[a-f0-9]{64}\.png/)
    expect(homepage).toMatch(/\/images\/screenshots\/1_home\.[a-f0-9]{64}\.png/)
    for (const page of [homepage, downloadPage, installationPage]) {
      expect(page).toMatch(/\/images\/platforms\/linux\.[a-f0-9]{64}\.svg/)
      expect(page).not.toContain('/assets/wolpi/')
      expect(page).not.toContain('>◆<')
    }
  })
})
