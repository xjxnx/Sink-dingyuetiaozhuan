import { LinkPinSchema } from '#shared/schemas/link'

defineRouteMeta({
  openAPI: {
    description: 'Set whether a short link is pinned on the public homepage',
    security: [{ bearerAuth: [] }],
    requestBody: { required: true, content: { 'application/json': {} } },
  },
})

export default eventHandler(async (event) => {
  assertLinkWritesAllowed(event, 'edit')
  const { slug, id, pinned } = await readValidatedBody(event, LinkPinSchema.parse)
  const link = await setLinkPinned(event, slug, id, pinned)
  return { link: sanitizeLinkPassword(link) }
})
