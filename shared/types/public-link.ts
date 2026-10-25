export interface PublicLink {
  slug: string
  title: string
  description: string
}

export interface PublicLinksResponse {
  links: PublicLink[]
  cursor?: string
  list_complete: boolean
}
