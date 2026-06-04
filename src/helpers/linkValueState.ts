import {type Path, set, unset, type FormPatch} from 'sanity'
import {z} from 'zod'

import type {BuiltInLinkType, CustomLinkType, LinkValue} from '../types'

export const BUILT_IN_DESTINATION_FIELDS = {
  internal: 'internalLink',
  external: 'url',
  email: 'email',
  phone: 'phone',
  document: 'documentLink',
  media: 'mediaLink',
  sms: 'sms',
  whatsapp: 'whatsapp',
  fax: 'fax',
} as const satisfies Record<BuiltInLinkType, string>

export const DESTINATION_FIELD_NAMES = [
  ...Object.values(BUILT_IN_DESTINATION_FIELDS),
  'value',
] as const

const linkValueSchema = z
  .object({
    type: z.string().optional(),
    internalLink: z.unknown().optional(),
    url: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    documentLink: z
      .object({
        asset: z.unknown().optional(),
      })
      .passthrough()
      .optional(),
    mediaLink: z
      .object({
        asset: z.unknown().optional(),
      })
      .passthrough()
      .optional(),
    sms: z.string().optional(),
    whatsapp: z.string().optional(),
    fax: z.string().optional(),
    value: z.string().optional(),
  })
  .passthrough()

type ParsedLinkValue = z.infer<typeof linkValueSchema>

const isBuiltInLinkType = (type: string): type is BuiltInLinkType =>
  type in BUILT_IN_DESTINATION_FIELDS

const hasStringValue = (value: unknown): boolean => typeof value === 'string' && value.trim() !== ''

const hasDestinationValue = (link: ParsedLinkValue, fieldName: string): boolean => {
  switch (fieldName) {
    case 'internalLink':
      return Boolean(link.internalLink)
    case 'documentLink':
      return Boolean(link.documentLink?.asset)
    case 'mediaLink':
      return Boolean(link.mediaLink?.asset)
    case 'url':
      return hasStringValue(link.url)
    case 'email':
      return hasStringValue(link.email)
    case 'phone':
      return hasStringValue(link.phone)
    case 'sms':
      return hasStringValue(link.sms)
    case 'whatsapp':
      return hasStringValue(link.whatsapp)
    case 'fax':
      return hasStringValue(link.fax)
    case 'value':
      return hasStringValue(link.value)
    default:
      return false
  }
}

export const getDestinationFieldName = (
  type: string | undefined,
  customLinkTypes: CustomLinkType[],
): string | undefined => {
  if (!type) return undefined
  if (isBuiltInLinkType(type)) return BUILT_IN_DESTINATION_FIELDS[type]
  return customLinkTypes.some((customType) => customType.value === type) ? 'value' : undefined
}

const getTypeForDestinationField = (
  fieldName: string,
  availableTypeValues: string[],
  customLinkTypes: CustomLinkType[],
): string | undefined => {
  if (fieldName === 'value') {
    return customLinkTypes.find((customType) => availableTypeValues.includes(customType.value))
      ?.value
  }

  return Object.entries(BUILT_IN_DESTINATION_FIELDS).find(
    ([type, destinationField]) =>
      destinationField === fieldName && availableTypeValues.includes(type),
  )?.[0]
}

export const getCanonicalLinkType = ({
  value,
  availableTypeValues,
  customLinkTypes,
}: {
  value: LinkValue | undefined
  availableTypeValues: string[]
  customLinkTypes: CustomLinkType[]
}): string | undefined => {
  if (availableTypeValues.length === 0) return undefined

  const parsed = linkValueSchema.safeParse(value)
  if (!parsed.success) return availableTypeValues[0]

  const link = parsed.data
  const currentType = link.type
  const currentDestinationField = getDestinationFieldName(currentType, customLinkTypes)

  if (currentType && availableTypeValues.includes(currentType) && currentDestinationField) {
    if (hasDestinationValue(link, currentDestinationField)) return currentType

    const populatedInactiveFields = DESTINATION_FIELD_NAMES.filter(
      (fieldName) => fieldName !== currentDestinationField && hasDestinationValue(link, fieldName),
    )
    if (populatedInactiveFields.length === 1) {
      return getTypeForDestinationField(
        populatedInactiveFields[0],
        availableTypeValues,
        customLinkTypes,
      )
    }

    return currentType
  }

  const inferredField = DESTINATION_FIELD_NAMES.find((fieldName) =>
    hasDestinationValue(link, fieldName),
  )
  const inferredType =
    inferredField && getTypeForDestinationField(inferredField, availableTypeValues, customLinkTypes)

  return inferredType || availableTypeValues[0]
}

export const getLinkStatePatches = ({
  value,
  canonicalType,
  activeDestinationField,
  path = [],
}: {
  value: LinkValue | undefined
  canonicalType: string | undefined
  activeDestinationField: string | undefined
  path?: Path
}): FormPatch[] => {
  if (!canonicalType || !activeDestinationField) return []

  const patches: FormPatch[] = []
  if (value?.type !== canonicalType) {
    patches.push(set(canonicalType, [...path, 'type']))
  }

  for (const fieldName of DESTINATION_FIELD_NAMES) {
    if (fieldName === activeDestinationField) continue
    if (value && fieldName in value) {
      patches.push(unset([...path, fieldName]))
    }
  }

  return patches
}
