import type { DashboardLink, DashboardLinkFormData } from '@/types/dashboard-links'
import { isMaskedLinkPassword } from '#shared/utils/link-password'
import { date2unix, unix2date } from './time'

export type LinkUrlValidationError
  = | { kind: 'required' }
    | { kind: 'invalid' }
    | { kind: 'too_long', length: number }

export function normalizeLinkFormUrl(value: string): string {
  const url = value.trim()
  if (!url)
    return ''

  // Keep explicit schemes and relative paths for the existing URL validator.
  const hasPort = /^[^/?#:\s]+:\d+(?:[/?#]|$)/.test(url)
  if ((!hasPort && /^[a-z][a-z\d+.-]*:/i.test(url)) || /^\/(?!\/)/.test(url))
    return url

  return url.startsWith('//') ? `https:${url}` : `https://${url}`
}

export function getLinkUrlValidationError(
  value: unknown,
  maxUrlLength: number,
  optional = false,
): LinkUrlValidationError | undefined {
  if (typeof value !== 'string')
    return { kind: 'invalid' }

  const url = normalizeLinkFormUrl(value)
  if (!url)
    return optional ? undefined : { kind: 'required' }
  if (url.length > maxUrlLength)
    return { kind: 'too_long', length: url.length }

  // URL.canParse also accepts incomplete HTTP prefixes that cannot redirect reliably.
  if (/^https?:/i.test(url) && !/^https?:\/\/[^/\\]/i.test(url))
    return { kind: 'invalid' }

  return URL.canParse(url) ? undefined : { kind: 'invalid' }
}

export function createLinkFormInitialValues(link: Partial<DashboardLink>): DashboardLinkFormData {
  return {
    url: link.url ?? '',
    slug: link.slug ?? '',
    comment: link.comment ?? '',
    tags: link.tags ?? [],
    expiration: link.expiration ? unix2date(link.expiration) : undefined,
    google: link.google ?? '',
    apple: link.apple ?? '',
    title: link.title ?? '',
    description: link.description ?? '',
    image: link.image ?? '',
    cloaking: link.cloaking ?? false,
    redirectWithQuery: link.redirectWithQuery ?? false,
    proxy: link.proxy ?? false,
    password: link.password ?? '',
    unsafe: link.unsafe ?? false,
    geo: link.geo ? Object.entries(link.geo).map(([country, url]) => ({ country, url })) : [],
  }
}

export function normalizeLinkFormSubmitPayload(value: DashboardLinkFormData, isEdit: boolean) {
  const geo: Record<string, string> = {}
  value.geo?.forEach((route) => {
    const country = route.country.trim().toUpperCase()
    const url = normalizeLinkFormUrl(route.url)
    if (country && url)
      geo[country] = url
  })

  let password: string | undefined = value.password
  if (isMaskedLinkPassword(password) || (!isEdit && password === ''))
    password = undefined

  return {
    url: normalizeLinkFormUrl(value.url),
    slug: value.slug,
    comment: value.comment || undefined,
    tags: value.tags,
    expiration: value.expiration ? date2unix(value.expiration, 'end') : undefined,
    google: normalizeLinkFormUrl(value.google) || undefined,
    apple: normalizeLinkFormUrl(value.apple) || undefined,
    title: value.title || undefined,
    description: value.description || undefined,
    image: value.image || undefined,
    // Exclusivity is enforced by the visible switches; a hidden stored proxy must not rewrite cloaking.
    cloaking: value.cloaking,
    redirectWithQuery: value.redirectWithQuery,
    proxy: value.proxy,
    password,
    unsafe: isEdit ? value.unsafe : value.unsafe || undefined,
    geo: Object.keys(geo).length > 0 ? geo : undefined,
  }
}
