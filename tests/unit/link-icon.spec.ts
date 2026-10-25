import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchLinkIcon } from '../../server/utils/link-icon'
import { getLinkIconUrl } from '../../shared/utils/link-icon'

afterEach(() => vi.unstubAllGlobals())

describe('link icons', () => {
  it('uses the dashboard provider and forwards only the destination host', () => {
    const icon = getLinkIconUrl('https://user:password@example.com/subscription?token=secret#private', 'https://short.example')
    expect(icon).toBe('https://unavatar.webp.se/example.com?fallback=https%3A%2F%2Fshort.example%2Fzhelink-icon-192.png')
    for (const privateValue of ['user', 'password', 'subscription', 'secret', 'private'])
      expect(icon).not.toContain(privateValue)
  })

  it('returns image bytes without forwarding browser credentials', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    const fetcher = vi.fn().mockResolvedValue(new Response(bytes, { headers: { 'Content-Type': 'image/png' } }))
    vi.stubGlobal('fetch', fetcher)

    const icon = await fetchLinkIcon('https://unavatar.webp.se/example.com')
    expect(icon?.contentType).toBe('image/png')
    expect(new Uint8Array(icon!.data)).toEqual(bytes)
    expect(fetcher).toHaveBeenCalledWith('https://unavatar.webp.se/example.com', {
      headers: { 'Accept': 'image/*', 'User-Agent': 'Mozilla/5.0' },
      signal: expect.any(AbortSignal),
    })
  })

  it('falls back on upstream failures and non-image responses', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('upstream error', { status: 502 }))
      .mockResolvedValueOnce(new Response('<html>Error</html>', { headers: { 'Content-Type': 'text/html' } }))
      .mockRejectedValueOnce(new Error('timeout'))
    vi.stubGlobal('fetch', fetcher)

    for (let index = 0; index < 3; index++)
      expect(await fetchLinkIcon('https://unavatar.webp.se/example.com')).toBeNull()
  })
})
