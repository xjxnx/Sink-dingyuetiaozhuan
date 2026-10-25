import { parseURL } from 'ufo'

export function getLinkIconUrl(url: string, origin: string): string {
  const { host } = parseURL(url)
  const fallback = `${origin}/zhelink-icon-192.png`
  return host ? `https://unavatar.webp.se/${host}?fallback=${encodeURIComponent(fallback)}` : fallback
}
