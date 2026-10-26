import type { PublicLinksResponse } from '../../shared/types/public-link'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { links, linkTags, tags } from '../../server/database/schema'
import { db, deleteStoredLinks, fetch, fetchWithAuth, getD1Link, getStoredLink, postJson, putJson, setLinkStoreD1Mode } from '../utils'

const createdSlugs = new Set<string>()
let tag: string

beforeEach(async () => {
  await setLinkStoreD1Mode()
  tag = `order-${crypto.randomUUID().slice(0, 12)}`
  await db.insert(tags).values({ name: tag })
})

afterEach(async () => {
  await deleteStoredLinks([...createdSlugs])
  createdSlugs.clear()
  await db.delete(tags).where(eq(tags.name, tag))
})

async function seedLinks(count: number) {
  const now = Math.floor(Date.now() / 1000)
  const fixtures = Array.from({ length: count }, (_, index) => {
    const slug = `${tag}-${index}`
    createdSlugs.add(slug)
    return { slug, id: `id-${index}`, url: 'https://example.com', normalizedUrl: 'https://example.com', createdAt: now + index, updatedAt: now }
  })
  for (let offset = 0; offset < count; offset += 8)
    await db.insert(links).values(fixtures.slice(offset, offset + 8))
  await db.insert(linkTags).values(fixtures.map(link => ({ linkSlug: link.slug, tagName: tag })))
  return fixtures.toReversed()
}

function move(source: { slug: string, id: string }, target: { slug: string, id: string }, placement = 'before') {
  return { slug: source.slug, id: source.id, targetSlug: target.slug, targetId: target.id, placement }
}

async function listCustomOrder(limit = 1000) {
  const result: string[] = []
  let cursor = ''
  do {
    const response = await fetchWithAuth(`/api/link/list?sort=manual&tag=${tag}&limit=${limit}&cursor=${encodeURIComponent(cursor)}`)
    expect(response.status).toBe(200)
    const page = await response.json() as { links: { slug: string }[], cursor?: string }
    result.push(...page.links.map(link => link.slug))
    cursor = page.cursor ?? ''
  } while (cursor)
  return result
}

describe('shared custom link order', () => {
  it('moves links both ways, persists the order, and keeps explicit chronological sorting', async () => {
    const fixtures = await seedLinks(5)
    expect(await listCustomOrder()).toEqual(fixtures.map(link => link.slug))
    expect((await putJson('/api/link/reorder', move(fixtures[4]!, fixtures[1]!))).status).toBe(200)
    const expected = [fixtures[0]!, fixtures[4]!, ...fixtures.slice(1, 4)]
    expect(await listCustomOrder(2)).toEqual(expected.map(link => link.slug))
    expect((await putJson('/api/link/reorder', move(fixtures[4]!, fixtures[3]!, 'after'))).status).toBe(200)
    expect(await listCustomOrder()).toEqual(fixtures.map(link => link.slug))
    const chronological = await (await fetchWithAuth(`/api/link/list?sort=newest&tag=${tag}`)).json() as { links: { slug: string }[] }
    expect(chronological.links.map(link => link.slug)).toEqual(fixtures.map(link => link.slug))
    expect((await putJson('/api/link/reorder', move(fixtures[0]!, fixtures[0]!, 'after'))).status).toBe(200)
    expect(await listCustomOrder()).toEqual(fixtures.map(link => link.slug))
  })

  it('synchronizes the homepage across pages while preserving pins, visibility, and expiry', async () => {
    const fixtures = await seedLinks(28)
    const pinned = fixtures[25]!
    const hidden = fixtures[26]!
    const expired = fixtures[27]!
    await db.update(links).set({ pinned: true }).where(eq(links.slug, pinned.slug))
    await db.update(links).set({ showOnHomepage: false }).where(eq(links.slug, hidden.slug))
    await db.update(links).set({ effectiveExpiresAt: 1 }).where(eq(links.slug, expired.slug))
    expect((await putJson('/api/link/reorder', move(fixtures[0]!, fixtures[20]!, 'after'))).status).toBe(200)
    const expected = [pinned, ...fixtures.slice(1, 21), fixtures[0]!, ...fixtures.slice(21, 25)].map(link => link.slug)
    const seen: string[] = []
    let cursor = ''
    do {
      const response = await fetch(`/_public/links?cursor=${encodeURIComponent(cursor)}`)
      expect(response.status).toBe(200)
      const page = await response.json() as PublicLinksResponse
      seen.push(...page.links.map(link => link.slug).filter(slug => createdSlugs.has(slug)))
      cursor = page.cursor ?? ''
    } while (cursor)
    expect(seen).toEqual(expected)
    // Hidden entries remain sortable in the dashboard; expired entries do not appear in its active tab.
    expect(await listCustomOrder(3)).toEqual([pinned.slug, ...expected.slice(1), hidden.slug])
  })

  it('moves only the requested link while retaining the relative order of filtered-out links', async () => {
    const fixtures = await seedLinks(6)
    await db.delete(linkTags).where(eq(linkTags.linkSlug, fixtures[2]!.slug))
    expect((await putJson('/api/link/reorder', move(fixtures[5]!, fixtures[1]!))).status).toBe(200)
    const all = await (await fetchWithAuth('/api/link/list?sort=manual&limit=1000')).json() as { links: { slug: string }[] }
    expect(all.links.map(link => link.slug).filter(slug => createdSlugs.has(slug)))
      .toEqual([fixtures[0], fixtures[5], ...fixtures.slice(1, 5)].map(link => link!.slug))
    expect(await listCustomOrder()).not.toContain(fixtures[2]!.slug)
  })

  it('requires authentication, valid placement, and both current link identities without partial writes', async () => {
    const fixtures = await seedLinks(3)
    const input = move(fixtures[2]!, fixtures[0]!)
    const before = await Promise.all(fixtures.map(link => getD1Link(link.slug)))
    expect((await putJson('/api/link/reorder', input, false)).status).toBe(401)
    expect((await putJson('/api/link/reorder', { ...input, placement: 'middle' })).status).toBe(400)
    expect((await putJson('/api/link/reorder', { ...input, id: 'replaced' })).status).toBe(404)
    expect((await putJson('/api/link/reorder', { ...input, targetId: 'replaced' })).status).toBe(404)
    expect((await putJson('/api/link/reorder', { ...input, targetSlug: 'missing-link' })).status).toBe(404)
    expect(await Promise.all(fixtures.map(link => getD1Link(link.slug)))).toEqual(before)
  })

  it('keeps redirect settings, passwords, tags, versions, and caches unchanged and puts new links first', async () => {
    const fixtures = await seedLinks(2)
    const slug = `${tag}-protected`
    createdSlugs.add(slug)
    const created = await postJson('/api/link/create', { slug, url: 'https://example.com/protected', password: 'secret', tags: [tag] })
    const { link } = await created.json() as { link: { id: string, slug: string } }
    const before = await getD1Link(slug)
    const cached = await getStoredLink(slug)
    expect((await putJson('/api/link/reorder', move(link, fixtures[1]!, 'after'))).status).toBe(200)
    const after = await getD1Link(slug)
    expect(after).toEqual({ ...before, sortOrder: after!.sortOrder })
    expect(await getStoredLink(slug)).toEqual(cached)
    expect((await putJson('/api/link/edit', { slug, url: 'https://example.com/edited', tags: [tag] })).status).toBe(201)
    expect(await listCustomOrder()).toEqual([...fixtures.map(item => item.slug), slug])
    const newSlug = `${tag}-new`
    createdSlugs.add(newSlug)
    expect((await postJson('/api/link/create', { slug: newSlug, url: 'https://example.com/new', tags: [tag] })).status).toBe(201)
    expect((await listCustomOrder())[0]).toBe(newSlug)
  })
})
