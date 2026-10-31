import { describe, expect, it } from 'vitest'
import { getAllLevels } from '../levels/LevelRegistry'
import html from '../../index.html?raw'

// index.html is what a crawler sees before any JS runs: the share meta, the VideoGame
// JSON-LD and the visually hidden #about text.

function jsonLd(): Record<string, unknown> {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
  if (!match) throw new Error('no JSON-LD script in index.html')
  return JSON.parse(match[1])
}

function metaContent(attr: 'name' | 'property', key: string): string | undefined {
  return html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`))?.[1]
}

function aboutSection(): string {
  const match = html.match(/<main id="about" class="visually-hidden">([\s\S]*?)<\/main>/)
  if (!match) throw new Error('no #about section in index.html')
  return match[1]
}

const textOf = (markup: string) => markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

describe('index.html structured data', () => {
  it('is one schema.org VideoGame with the required fields', () => {
    const game = jsonLd()
    expect(game['@context']).toBe('https://schema.org')
    expect(game['@type']).toBe('VideoGame')
    expect(game.name).toBe('ShooterCoaster')
    expect(game.url).toBe('https://scoaster.com/')
    expect(game.genre).toContain('Shooter')
    expect(game.gamePlatform).toBe('Web browser')
    expect(game.applicationCategory).toBe('Game')
    expect(game.operatingSystem).toBe('Any')
    expect(game.offers).toEqual({ '@type': 'Offer', price: '0', priceCurrency: 'USD' })
    expect(game.author).toEqual({ '@type': 'Person', name: 'Alex Belyeu' })
  })

  it('matches the share card meta', () => {
    const game = jsonLd()
    expect(game.description).toBe(metaContent('name', 'description'))
    expect(game.image).toBe(metaContent('property', 'og:image'))
    expect(game.url).toBe(metaContent('property', 'og:url'))
  })
})

describe('index.html about text', () => {
  it('has exactly one h1 and keeps lang="en"', () => {
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1)
    expect(html).toContain('<html lang="en">')
  })

  it('sits outside #root, visually hidden but not display:none', () => {
    expect(html.indexOf('<main id="about"')).toBeLessThan(html.indexOf('<div id="root">'))
    expect(html).toContain('<div id="root"></div>')
    const style = html.match(/\.visually-hidden \{([\s\S]*?)\}/)?.[1] ?? ''
    expect(style).toContain('clip-path: inset(50%)')
    expect(style).not.toMatch(/display:\s*none|visibility:\s*hidden/)
  })

  it('names every world and stays short', () => {
    const text = textOf(aboutSection())
    for (const level of getAllLevels()) expect(text).toContain(level.name)
    const words = text.split(' ').length
    expect(words).toBeGreaterThanOrEqual(150)
    expect(words).toBeLessThanOrEqual(250)
  })
})
