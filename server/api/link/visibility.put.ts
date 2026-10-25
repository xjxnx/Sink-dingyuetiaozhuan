import { LinkVisibilitySchema } from '#shared/schemas/link'

defineRouteMeta({
  openAPI: {
    description: 'Set whether a short link appears on the public homepage',
    security: [{ bearerAuth: [] }],
    requestBody: { required: true, content: { 'application/json': {} } },
  },
})

export default eventHandler(async (event) => {
  assertLinkWritesAllowed(event, 'edit')
  const { slug, id, showOnHomepage } = await readValidatedBody(event, LinkVisibilitySchema.parse)
  const link = await setLinkVisibility(event, slug, id, showOnHomepage)
  return { link: sanitizeLinkPassword(link) }
})
