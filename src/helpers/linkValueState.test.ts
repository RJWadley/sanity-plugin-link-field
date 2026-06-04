import {describe, expect, it} from 'vitest'

import {getCanonicalLinkType, getDestinationFieldName, getLinkStatePatches} from './linkValueState'
import type {CustomLinkType, LinkValue} from '../types'

const customLinkTypes = [
  {
    title: 'Archive',
    value: 'archive',
    icon: () => null,
    options: [{title: 'Blog', value: '/blog'}],
  },
] satisfies CustomLinkType[]

const allTypes = [
  'internal',
  'external',
  'email',
  'phone',
  'document',
  'media',
  'sms',
  'whatsapp',
  'fax',
  'archive',
]

describe('link value state', () => {
  it('repairs a missing type from a populated internal destination', () => {
    const value = {
      _type: 'link',
      internalLink: {_ref: 'page-1', _type: 'reference'},
    } as unknown as LinkValue

    expect(
      getCanonicalLinkType({
        value,
        availableTypeValues: allTypes,
        customLinkTypes,
      }),
    ).toBe('internal')
  })

  it('repairs a wrong type when only another destination is populated', () => {
    const value = {
      _type: 'link',
      type: 'external',
      internalLink: {_ref: 'page-1', _type: 'reference'},
    } as unknown as LinkValue

    expect(
      getCanonicalLinkType({
        value,
        availableTypeValues: allTypes,
        customLinkTypes,
      }),
    ).toBe('internal')
  })

  it('keeps a valid current type when its destination is populated', () => {
    const value = {
      _type: 'link',
      type: 'external',
      url: 'https://example.com',
      internalLink: {_ref: 'page-1', _type: 'reference'},
    } as unknown as LinkValue

    expect(
      getCanonicalLinkType({
        value,
        availableTypeValues: allTypes,
        customLinkTypes,
      }),
    ).toBe('external')
  })

  it('uses the first available type as fallback when no destination is populated', () => {
    expect(
      getCanonicalLinkType({
        value: {_type: 'link'} as LinkValue,
        availableTypeValues: ['external', 'email'],
        customLinkTypes,
      }),
    ).toBe('external')
  })

  it('maps custom types to the value destination field', () => {
    expect(getDestinationFieldName('archive', customLinkTypes)).toBe('value')
  })

  it('sets canonical type and unsets inactive destination fields', () => {
    const value = {
      _type: 'link',
      type: 'external',
      url: 'https://example.com',
      internalLink: {_ref: 'page-1', _type: 'reference'},
      email: 'hello@example.com',
    } as unknown as LinkValue

    expect(
      getLinkStatePatches({
        value,
        canonicalType: 'external',
        activeDestinationField: 'url',
      }).map((patch) => ({
        type: patch.type,
        path: patch.path,
        value: 'value' in patch ? patch.value : undefined,
      })),
    ).toEqual([
      {type: 'unset', path: ['internalLink'], value: undefined},
      {type: 'unset', path: ['email'], value: undefined},
    ])
  })

  it('sets missing type while preserving the active destination field', () => {
    const value = {
      _type: 'link',
      internalLink: {_ref: 'page-1', _type: 'reference'},
      url: 'https://example.com',
    } as unknown as LinkValue

    expect(
      getLinkStatePatches({
        value,
        canonicalType: 'internal',
        activeDestinationField: 'internalLink',
      }).map((patch) => ({
        type: patch.type,
        path: patch.path,
        value: 'value' in patch ? patch.value : undefined,
      })),
    ).toEqual([
      {type: 'set', path: ['type'], value: 'internal'},
      {type: 'unset', path: ['url'], value: undefined},
    ])
  })
})
