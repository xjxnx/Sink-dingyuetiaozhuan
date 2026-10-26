import { ReorderLinkSchema } from '#shared/schemas/link'

defineRouteMeta({
  openAPI: {
    description: 'Move a link before or after another link in the shared custom order',
    security: [{ bearerAuth: [] }],
    requestBody: { required: true, content: { 'application/json': {} } },
  },
})

export default eventHandler(async (event) => {
  assertLinkWritesAllowed(event, 'reorder')
  const input = await readValidatedBody(event, ReorderLinkSchema.parse)
  await reorderLink(event, input)
  return { success: true }
})
