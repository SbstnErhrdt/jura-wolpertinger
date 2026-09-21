import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const homepagePath = resolve(process.cwd(), 'website/layouts/index.html')

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
      expect(homepage).toContain(`/screenshots/${screenshot}`)
    }
    expect(homepage).not.toContain('/screenshots/3_wiederholen.png')
    expect(homepage).not.toContain('/screenshots/4_pruefungen.png')
    expect(homepage).not.toContain('/screenshots/5_bewertung.png')
    expect(homepage).not.toContain('/screenshots/6_auswertung.png')
  })

  it('prioritizes the hero image and lazy-loads images below the fold', async () => {
    const homepage = await readFile(homepagePath, 'utf8')

    expect(homepage).toMatch(/1_home\.png[^>]+fetchpriority="high"/)
    expect(homepage).toMatch(/assets\/wolpi\/cards\.png[^>]+loading="lazy"/)
    expect(homepage).toMatch(/3_podcasts\.png[^>]+loading="lazy"/)
    expect(homepage).toMatch(/assets\/wolpi\/desktop\.png[^>]+loading="lazy"/)
  })
})
