import type { PublicLinksResponse } from '../../shared/types/public-link'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { links } from '../../server/database/schema'
import { db, deleteStoredLinks, fetch, fetchWithAuth, getD1Link, getStoredLink, postJson, putJson, setLinkStoreD1Mode } from '../utils'

const createdSlugs = new Set<string>()

function uniqueSlug() {
  const slug = `public-${crypto.randomUUID()}`
  createdSlugs.add(slug)
  return slug
}

beforeEach(setLinkStoreD1Mode)

afterEach(async () => {
  await deleteStoredLinks([...createdSlugs])
  createdSlugs.clear()
})

describe('public homepage links', () => {
  it('hides and restores a link without changing its redirect, password, tags, or expiration', async () => {
    const slug = uniqueSlug()
    const expiration = Math.floor(Date.now() / 1000) + 3600
    const created = await (await postJson('/api/link/create', {
      slug,
      url: 'https://example.com/private',
      title: 'Private link',
      password: 'secret-password',
      expiration,
      tags: ['kept'],
    })).json() as { link: { id: string } }
    const before = await getD1Link(slug)
    const hidden = await putJson('/api/link/visibility', { slug, id: created.link.id, showOnHomepage: false })
    expect(hidden.status).toBe(200)
    const after = await getD1Link(slug)
    expect(after).toEqual({ ...before, showOnHomepage: false, updatedAt: after!.updatedAt })
    expect(after!.updatedAt).toBeGreaterThan(before!.updatedAt)
    expect((await getStoredLink(slug))?.showOnHomepage).toBe(false)
    expect(await hidden.text()).not.toContain(before!.password)
    const directory = await (await fetch('/_public/links?showOnHomepage=true')).json() as PublicLinksResponse
    expect(directory.links.some(link => link.slug === slug)).toBe(false)
    expect((await fetch(`/_public/link-icon?slug=${slug}`)).status).toBe(404)
    expect(await (await fetch(`/${slug}`)).text()).toContain('type="password"')

    // Editing other fields must keep a previously disabled homepage entry hidden.
    expect((await putJson('/api/link/edit', { slug, url: 'https://example.com/edited', tags: ['kept'], expiration })).status).toBe(201)
    expect((await getD1Link(slug))?.showOnHomepage).toBe(false)
    const shown = await putJson('/api/link/visibility', { slug, id: created.link.id, showOnHomepage: true })
    expect(shown.status).toBe(200)
    expect((await getStoredLink(slug))?.showOnHomepage).toBe(true)
    expect((await (await fetch('/_public/links')).json() as PublicLinksResponse).links.some(link => link.slug === slug)).toBe(true)
    const listed = await (await fetchWithAuth('/api/link/list')).json() as { links: { slug: string, showOnHomepage: boolean, tags: string[] }[] }
    expect(listed.links.find(link => link.slug === slug)).toMatchObject({ showOnHomepage: true, tags: ['kept'] })
  })

  it('requires authentication and validates visibility changes against the link identity', async () => {
    const slug = uniqueSlug()
    const { link } = await (await postJson('/api/link/create', { slug, url: 'https://example.com' })).json() as { link: { id: string } }
    const body = { slug, id: link.id, showOnHomepage: false }
    expect((await putJson('/api/link/visibility', body, false)).status).toBe(401)
    expect((await putJson('/api/link/visibility', { ...body, showOnHomepage: 'false' })).status).toBe(400)
    expect((await putJson('/api/link/visibility', { ...body, id: 'replaced' })).status).toBe(404)
    expect((await getD1Link(slug))?.showOnHomepage).toBe(true)
  })

  it('filters hidden entries before pagination while keeping them in the dashboard', async () => {
    const now = Math.floor(Date.now() / 1000) + 1000
    const slugs = Array.from({ length: 27 }, uniqueSlug)
    const fixtures = slugs.map((slug, index) => ({
      slug,
      id: slug.slice(0, 26),
      url: 'https://example.com',
      normalizedUrl: 'https://example.com',
      createdAt: now + index,
      updatedAt: now + index,
      showOnHomepage: index % 2 === 0,
    }))
    for (let offset = 0; offset < fixtures.length; offset += 10)
      await db.insert(links).values(fixtures.slice(offset, offset + 10))
    const first = await (await fetch('/_public/links')).json() as PublicLinksResponse
    expect(first.links).toHaveLength(12)
    const second = await (await fetch(`/_public/links?cursor=${encodeURIComponent(first.cursor!)}`)).json() as PublicLinksResponse
    const seen = [...first.links, ...second.links].map(link => link.slug)
    slugs.forEach((slug, index) => expect(seen.includes(slug)).toBe(index % 2 === 0))
    const dashboard = await (await fetchWithAuth('/api/link/list?limit=100')).json() as { links: { slug: string }[] }
    for (const slug of slugs)
      expect(dashboard.links.some(link => link.slug === slug)).toBe(true)
  })

  it('publishes names, public notes, and slugs without credentials or private link fields', async () => {
    const slug = uniqueSlug()
    const response = await postJson('/api/link/create', {
      slug,
      url: 'https://private.example.com/subscription?token=secret',
      title: 'My subscription',
      description: 'Public subscription note',
      comment: 'Internal note',
      password: 'private-password',
      apple: 'https://private.example.com/apple',
      geo: { US: 'https://private.example.com/us' },
      tags: ['internal-tag'],
    })
    expect(response.status).toBe(201)

    const directory = await fetch('/_public/links')
    expect(directory.status).toBe(200)
    expect(directory.headers.get('Cache-Control')).toBe('no-store')
    const body = await directory.text()
    const data = JSON.parse(body) as PublicLinksResponse
    expect(data.links.find(link => link.slug === slug)).toEqual({ slug, title: 'My subscription', description: 'Public subscription note' })
    for (const link of data.links)
      expect(Object.keys(link).sort()).toEqual(['description', 'slug', 'title'])
    for (const secret of ['private.example.com', 'secret', 'Internal note', 'private-password', 'internal-tag'])
      expect(body).not.toContain(secret)

    // Clicking the short link must still enforce its original password gate.
    const gate = await fetch(`/${slug}`)
    expect(gate.status).toBe(200)
    expect(await gate.text()).toContain('type="password"')
    expect((await fetch('/api/link/list')).status).toBe(401)
  })

  it('uses slugs as fallback names and excludes expired links even with public query overrides', async () => {
    const activeSlug = uniqueSlug()
    const expiredSlug = uniqueSlug()
    const now = Math.floor(Date.now() / 1000)
    await db.insert(links).values([
      { slug: activeSlug, id: activeSlug.slice(0, 26), url: 'https://example.com/active', normalizedUrl: 'https://example.com/active', createdAt: now, updatedAt: now, title: '   ' },
      { slug: expiredSlug, id: expiredSlug.slice(0, 26), url: 'https://example.com/expired', normalizedUrl: 'https://example.com/expired', createdAt: now, updatedAt: now, effectiveExpiresAt: now - 1 },
    ])

    const response = await fetch('/_public/links?status=all&limit=1000')
    expect(response.status).toBe(200)
    const data = await response.json() as PublicLinksResponse
    expect(data.links).toContainEqual({ slug: activeSlug, title: activeSlug, description: '' })
    expect(data.links.some(link => link.slug === expiredSlug)).toBe(false)
  })

  it('reflects edited public notes and clears them without publishing internal comments', async () => {
    const slug = uniqueSlug()
    expect((await postJson('/api/link/create', {
      slug,
      url: 'https://example.com',
      description: 'Original public note',
      comment: 'Internal only',
    })).status).toBe(201)

    for (const description of ['Updated note\nSecond line', '']) {
      expect((await putJson('/api/link/edit', { slug, url: 'https://example.com', description })).status).toBe(201)
      const directory = await (await fetch('/_public/links')).json() as PublicLinksResponse
      expect(directory.links.find(link => link.slug === slug)).toEqual({ slug, title: slug, description })
    }
  })

  it('paginates without duplicates and rejects malformed cursors', async () => {
    const now = Math.floor(Date.now() / 1000) + 100
    const slugs = Array.from({ length: 13 }, uniqueSlug)
    await db.insert(links).values(slugs.map((slug, index) => ({
      slug,
      id: slug.slice(0, 26),
      url: 'https://example.com',
      normalizedUrl: 'https://example.com',
      createdAt: now + index,
      updatedAt: now + index,
    })))

    const first = await (await fetch('/_public/links')).json() as PublicLinksResponse
    expect(first.links).toHaveLength(12)
    expect(first.list_complete).toBe(false)
    expect(first.cursor).toBeTruthy()
    const next = await (await fetch(`/_public/links?cursor=${encodeURIComponent(first.cursor!)}`)).json() as PublicLinksResponse
    const seen = [...first.links, ...next.links].map(link => link.slug)
    expect(new Set(seen).size).toBe(seen.length)
    for (const slug of slugs)
      expect(seen).toContain(slug)
    expect((await fetch('/_public/links?cursor=invalid')).status).toBe(400)
  })

  it('rejects unknown and expired icon requests without returning link metadata', async () => {
    expect((await fetch('/_public/link-icon')).status).toBe(400)
    expect((await fetch(`/_public/link-icon?slug=${uniqueSlug()}`)).status).toBe(404)

    const slug = uniqueSlug()
    const now = Math.floor(Date.now() / 1000)
    await db.insert(links).values({
      slug,
      id: slug.slice(0, 26),
      url: 'https://private.example.com/subscription?token=secret',
      normalizedUrl: 'https://private.example.com/subscription',
      createdAt: now,
      updatedAt: now,
      effectiveExpiresAt: now - 1,
    })
    const response = await fetch(`/_public/link-icon?slug=${slug}`)
    expect(response.status).toBe(404)
    expect(await response.text()).not.toContain('private.example.com')
  })
})
