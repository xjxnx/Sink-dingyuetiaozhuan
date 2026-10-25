import type { PublicLinksResponse } from '#shared/types/public-link'
import { ListLinksQuerySchema } from '#shared/schemas/link'

const querySchema = ListLinksQuerySchema.pick({ cursor: true })

export default eventHandler(async (event): Promise<PublicLinksResponse> => {
  const { cursor } = await getValidatedQuery(event, querySchema.parse)
  const result = await listLinks(event, { limit: 12, cursor, sort: 'newest', status: 'active', showOnHomepage: true })

  setResponseHeader(event, 'Cache-Control', 'no-store')
  setResponseHeader(event, 'X-Robots-Tag', 'noindex')

  // Publish only display names and short-link slugs, never stored link records.
  return {
    links: result.links.map(link => ({ slug: link.slug, title: link.title?.trim() || link.slug })),
    cursor: result.cursor,
    list_complete: result.list_complete,
  }
})
