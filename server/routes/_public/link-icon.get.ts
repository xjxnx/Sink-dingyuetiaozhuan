import { LinkSlugQuerySchema } from '#shared/schemas/link'
import { getLinkIconUrl } from '#shared/utils/link-icon'

export default eventHandler(async (event) => {
  const { slug } = await getValidatedQuery(event, LinkSlugQuerySchema.parse)
  const link = await getAuthoritativeLink(event, slug)
  if (!link || link.showOnHomepage === false)
    throw createError({ status: 404, statusText: 'Link not found' })

  // Fetch the same icon as the dashboard without publishing the destination host.
  const icon = await fetchLinkIcon(getLinkIconUrl(link.url, getRequestURL(event).origin))
  setResponseHeader(event, 'Cache-Control', 'no-store')
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  setResponseHeader(event, 'X-Robots-Tag', 'noindex')
  if (!icon)
    return sendRedirect(event, '/zhelink-icon-192.png', 302)

  setResponseHeader(event, 'Content-Type', icon.contentType)
  return new Uint8Array(icon.data)
})
