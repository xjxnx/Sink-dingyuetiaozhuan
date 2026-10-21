import { CalendarDate } from '@internationalized/date'
import { describe, expect, it, vi } from 'vitest'
import {
  createLinkFormInitialValues,
  getLinkUrlValidationError,
  normalizeLinkFormSubmitPayload,
  normalizeLinkFormUrl,
} from '../../app/utils/link-form'
import { LINK_PASSWORD_MASK_PREFIX } from '../../shared/utils/link-password'

vi.mock('#shared/utils/link-password', async () => import('../../shared/utils/link-password'))

describe('link form values', () => {
  it('creates the current defaults for a new link', () => {
    expect(createLinkFormInitialValues({})).toEqual({
      url: '',
      slug: '',
      comment: '',
      tags: [],
      expiration: undefined,
      google: '',
      apple: '',
      title: '',
      description: '',
      image: '',
      cloaking: false,
      redirectWithQuery: false,
      proxy: false,
      password: '',
      unsafe: false,
      geo: [],
    })
  })

  it('maps stored expiration and geo records into editable values', () => {
    const expiration = Math.floor(new Date(2030, 0, 2, 12).getTime() / 1000)

    const values = createLinkFormInitialValues({
      expiration,
      geo: { us: ' https://us.example.com ', CA: 'https://ca.example.com' },
    })

    expect(values.expiration?.toString()).toBe('2030-01-02')
    expect(values.geo).toEqual([
      { country: 'us', url: ' https://us.example.com ' },
      { country: 'CA', url: 'https://ca.example.com' },
    ])
  })
})

describe('link URL validation', () => {
  it.each([
    ['www.hao123.com', 'https://www.hao123.com'],
    ['www.hao123.com:8443/path', 'https://www.hao123.com:8443/path'],
    [' example.com/path?a=1&token=a%2Fb#section ', 'https://example.com/path?a=1&token=a%2Fb#section'],
    ['//example.com/path', 'https://example.com/path'],
    ['http://example.com/path', 'http://example.com/path'],
    ['https://example.com/?token=a%2Fb', 'https://example.com/?token=a%2Fb'],
    ['mailto:test@example.com', 'mailto:test@example.com'],
    ['', ''],
  ])('normalizes %s before validation', (input, expected) => {
    expect(normalizeLinkFormUrl(input)).toBe(expected)
    if (input)
      expect(getLinkUrlValidationError(input, 100)).toBeUndefined()
  })

  it.each(['https:www.hao123.com', 'http:/example.com', 'https:///example.com', 'https://'])('rejects malformed HTTP URL %s', (url) => {
    expect(getLinkUrlValidationError(url, 100)).toEqual({ kind: 'invalid' })
  })

  it('distinguishes required, invalid, and over-limit URLs', () => {
    expect(getLinkUrlValidationError('  ', 20)).toEqual({ kind: 'required' })
    expect(getLinkUrlValidationError('not a URL', 20)).toEqual({ kind: 'invalid' })
    expect(getLinkUrlValidationError('/relative/path', 100)).toEqual({ kind: 'invalid' })
    expect(getLinkUrlValidationError('www.hao123.com', 20)).toEqual({ kind: 'too_long', length: 22 })
    expect(getLinkUrlValidationError('https://example.com/long', 20)).toEqual({
      kind: 'too_long',
      length: 24,
    })
  })

  it('accepts complete URLs and optional empty values', () => {
    expect(getLinkUrlValidationError('https://example.com', 100)).toBeUndefined()
    expect(getLinkUrlValidationError('', 100, true)).toBeUndefined()
  })
})

describe('link form submit payload', () => {
  function formValues(overrides: Partial<ReturnType<typeof createLinkFormInitialValues>> = {}) {
    return {
      ...createLinkFormInitialValues({}),
      url: 'https://example.com',
      slug: 'example',
      ...overrides,
    }
  }

  it.each([false, true])('submits absolute destinations when isEdit is %s', (isEdit) => {
    const payload = normalizeLinkFormSubmitPayload(formValues({
      url: 'www.hao123.com/path?token=a%2Fb#section',
      apple: 'apps.apple.com/app/example',
      google: 'play.google.com/store/apps/example',
      geo: [{ country: 'cn', url: 'www.hao123.com' }],
    }), isEdit)

    expect(payload).toMatchObject({
      url: 'https://www.hao123.com/path?token=a%2Fb#section',
      apple: 'https://apps.apple.com/app/example',
      google: 'https://play.google.com/store/apps/example',
      geo: { CN: 'https://www.hao123.com' },
    })
  })

  it('preserves an edited masked password by submitting undefined', () => {
    const payload = normalizeLinkFormSubmitPayload(formValues({
      password: `${LINK_PASSWORD_MASK_PREFIX}•••ret`,
    }), true)

    expect(payload.password).toBeUndefined()
  })

  it('submits an explicit replacement password', () => {
    const payload = normalizeLinkFormSubmitPayload(formValues({ password: 'replacement' }), true)

    expect(payload.password).toBe('replacement')
  })

  it('clears an existing password with an empty string', () => {
    const payload = normalizeLinkFormSubmitPayload(formValues({ password: '' }), true)

    expect(payload.password).toBe('')
  })

  it('omits an empty password when creating a link', () => {
    const payload = normalizeLinkFormSubmitPayload(formValues({ password: '' }), false)

    expect(payload.password).toBeUndefined()
  })

  it('passes proxy and cloaking through untouched; exclusivity belongs to the visible switches', () => {
    expect(normalizeLinkFormSubmitPayload(formValues({ proxy: true, cloaking: true }), true))
      .toMatchObject({ proxy: true, cloaking: true })
    expect(normalizeLinkFormSubmitPayload(formValues({ cloaking: true }), false))
      .toMatchObject({ cloaking: true, proxy: false })
  })

  it('normalizes geo rows into the current record representation', () => {
    const payload = normalizeLinkFormSubmitPayload(formValues({
      geo: [
        { country: ' us ', url: ' https://first.example.com ' },
        { country: '', url: 'https://missing-country.example.com' },
        { country: 'ca', url: '   ' },
        { country: 'US', url: 'https://last.example.com' },
      ],
    }), false)

    expect(payload.geo).toEqual({ US: 'https://last.example.com' })
    expect(normalizeLinkFormSubmitPayload(formValues(), false).geo).toBeUndefined()
  })

  it('keeps expiration, optional field, and unsafe submission semantics', () => {
    const expiration = new CalendarDate(2030, 1, 2)
    const createPayload = normalizeLinkFormSubmitPayload(formValues({
      comment: '',
      google: '   ',
      apple: '',
      title: '',
      description: '',
      image: '',
      expiration,
      unsafe: false,
    }), false)
    const expectedExpiration = Math.floor(new Date(2030, 0, 2, 23, 59, 59).getTime() / 1000)

    expect(createPayload).toMatchObject({
      comment: undefined,
      google: undefined,
      apple: undefined,
      title: undefined,
      description: undefined,
      image: undefined,
      expiration: expectedExpiration,
      unsafe: undefined,
    })
    expect(normalizeLinkFormSubmitPayload(formValues({ unsafe: false }), true).unsafe).toBe(false)
    expect(normalizeLinkFormSubmitPayload(formValues(), false).expiration).toBeUndefined()
  })
})
