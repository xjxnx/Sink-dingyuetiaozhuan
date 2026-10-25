export async function fetchLinkIcon(url: string): Promise<{ data: ArrayBuffer, contentType: string } | null> {
  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'image/*', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    })
    const contentType = response.headers.get('Content-Type') || ''
    if (!response.ok || !contentType.startsWith('image/')) {
      await response.body?.cancel()
      return null
    }

    return { data: await response.arrayBuffer(), contentType }
  }
  catch {
    return null
  }
}
