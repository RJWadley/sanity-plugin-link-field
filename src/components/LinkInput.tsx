import {Box, Flex, Stack, Text} from '@sanity/ui'
import {memo, type ReactNode, useCallback, useEffect, useMemo} from 'react'
import {
  type FieldMember,
  FormFieldValidationStatus,
  ObjectInputMember,
  type StringInputProps,
} from 'sanity'

import {CustomLinkInput} from './CustomLinkInput'
import {LinkTypeInput} from './LinkTypeInput'
import {
  DESTINATION_FIELD_NAMES,
  getCanonicalLinkType,
  getDestinationFieldName,
  getLinkStatePatches,
} from '../helpers/linkValueState'
import {isCustomLink} from '../helpers/typeGuards'
import {LinkInputProps} from '../types'

const fullWidthStyle = {width: '100%'} as const
const validationBoxStyle = {
  contain: 'size',
  marginBottom: '6px',
  marginLeft: 'auto',
  marginRight: '12px',
} as const
const destinationFieldNameSet = new Set<string>(DESTINATION_FIELD_NAMES)

const getMemberName = (member: FieldMember): string | undefined => (member as {name?: string}).name

/**
 * Custom input component for the link object.
 * Nicely renders the type and link fields next to each other, with the
 * description and any validation errors for the link field below them.
 *
 * The rest of the fields ("blank" and "advanced") are rendered as usual.
 */
export const LinkInput = memo(function LinkInput(props: LinkInputProps) {
  const members = props.members as FieldMember[]
  const {options} = props.schemaType
  const handleChange = props.onChange
  const enabledBuiltInLinkTypes = options?.enabledBuiltInLinkTypes ?? props.enabledBuiltInLinkTypes
  const linkableSchemaTypes = options?.linkableSchemaTypes ?? props.linkableSchemaTypes
  const customLinkTypes = options?.customLinkTypes ?? props.customLinkTypes
  const weakReferences = options?.weakReferences ?? props.weakReferences
  const referenceFilterOptions = options?.referenceFilterOptions ?? props.referenceFilterOptions
  const hasFieldLevelLinkableSchemaTypes = Array.isArray(options?.linkableSchemaTypes)
  const hasFieldLevelWeakReferences = typeof options?.weakReferences === 'boolean'
  const hasFieldLevelReferenceFilterOptions = typeof options?.referenceFilterOptions !== 'undefined'
  const availableTypeValues = useMemo(() => {
    const builtInTypes = enabledBuiltInLinkTypes.filter(
      (type) => type !== 'internal' || linkableSchemaTypes?.length > 0,
    )
    const customTypes = customLinkTypes.map((type) => type.value)
    return [...builtInTypes, ...customTypes]
  }, [customLinkTypes, enabledBuiltInLinkTypes, linkableSchemaTypes])

  const canonicalType = useMemo(
    () =>
      getCanonicalLinkType({
        value: props.value,
        availableTypeValues,
        customLinkTypes,
      }),
    [availableTypeValues, customLinkTypes, props.value],
  )

  const activeDestinationFieldName = useMemo(
    () => getDestinationFieldName(canonicalType, customLinkTypes),
    [canonicalType, customLinkTypes],
  )

  useEffect(() => {
    if (props.readOnly) return

    const patches = getLinkStatePatches({
      value: props.value,
      canonicalType,
      activeDestinationField: activeDestinationFieldName,
    })
    if (patches.length > 0) handleChange(patches)
  }, [activeDestinationFieldName, canonicalType, handleChange, props.readOnly, props.value])

  const textField = useMemo(
    () => members.find((member) => getMemberName(member) === 'text'),
    [members],
  )
  const typeField = useMemo(
    () => members.find((member) => getMemberName(member) === 'type'),
    [members],
  )
  const activeDestinationField = useMemo(
    () =>
      activeDestinationFieldName
        ? members.find((member) => getMemberName(member) === activeDestinationFieldName)
        : undefined,
    [activeDestinationFieldName, members],
  )
  const otherFields = useMemo(
    () =>
      members.filter((member) => {
        const name = getMemberName(member)
        return name !== 'text' && name !== 'type' && !destinationFieldNameSet.has(name || '')
      }),
    [members],
  )

  const linkFieldValidation = activeDestinationField?.field.validation ?? []
  const linkFieldDescription = activeDestinationField?.field.schemaType.description

  const description = useMemo(
    () =>
      // If a custom link type is used, use its description if it has one.
      props.value && isCustomLink(props.value)
        ? customLinkTypes.find((type) => type.value === props.value?.type)?.description
        : // Fallback to the description of the current link type field.
          linkFieldDescription,
    [customLinkTypes, linkFieldDescription, props.value],
  )

  const renderProps = useMemo(
    () => ({
      renderAnnotation: props.renderAnnotation,
      renderBlock: props.renderBlock,
      renderField: props.renderField,
      renderInlineBlock: props.renderInlineBlock,
      renderInput: props.renderInput,
      renderItem: props.renderItem,
      renderPreview: props.renderPreview,
    }),
    [
      props.renderAnnotation,
      props.renderBlock,
      props.renderField,
      props.renderInlineBlock,
      props.renderInput,
      props.renderItem,
      props.renderPreview,
    ],
  )

  const renderInlineField = useCallback(
    (fieldProps: {children: ReactNode}) => <>{fieldProps.children}</>,
    [],
  )

  const inlineFieldRenderProps = useMemo(
    () => ({
      ...renderProps,
      renderField: renderInlineField,
    }),
    [renderInlineField, renderProps],
  )

  const textFieldSchemaType = useMemo(
    () => ({
      ...textField?.field.schemaType,
      title: options?.textLabel || textField?.field.schemaType.title,
    }),
    [options?.textLabel, textField?.field.schemaType],
  )

  const renderCustomLinkInput = useCallback(
    (inputProps: StringInputProps) => (
      <CustomLinkInput customLinkTypes={customLinkTypes} {...inputProps} />
    ),
    [customLinkTypes],
  )
  const handleSelectType = useCallback(
    (nextType: string) => {
      if (props.readOnly) return

      const nextDestinationField = getDestinationFieldName(nextType, customLinkTypes)
      const patches = getLinkStatePatches({
        value: props.value,
        canonicalType: nextType,
        activeDestinationField: nextDestinationField,
      })
      if (patches.length > 0) handleChange(patches)
    },
    [customLinkTypes, handleChange, props.readOnly, props.value],
  )

  const renderLinkTypeInput = useCallback(
    (inputProps: StringInputProps) => (
      <LinkTypeInput
        customLinkTypes={customLinkTypes}
        linkableSchemaTypes={linkableSchemaTypes}
        enabledBuiltInLinkTypes={enabledBuiltInLinkTypes}
        onSelectType={handleSelectType}
        {...inputProps}
      />
    ),
    [customLinkTypes, enabledBuiltInLinkTypes, handleSelectType, linkableSchemaTypes],
  )

  const linkFieldSchemaType = useMemo(() => {
    if (!activeDestinationField) return undefined

    const schemaType: Record<string, unknown> = {
      ...activeDestinationField.field.schemaType,
      title: undefined,
      description: undefined,
    }

    if (activeDestinationFieldName === 'internalLink') {
      if (hasFieldLevelLinkableSchemaTypes) {
        schemaType.to = linkableSchemaTypes.map((type) => ({type}))
      }

      if (hasFieldLevelWeakReferences) {
        schemaType.weak = weakReferences
      }

      if (hasFieldLevelReferenceFilterOptions) {
        schemaType.options = {
          disableNew: true,
          ...referenceFilterOptions,
        }
      }
    }

    if (activeDestinationFieldName === 'value') {
      schemaType.components = {
        ...activeDestinationField.field.schemaType.components,
        input: renderCustomLinkInput,
      }
    }

    return schemaType as unknown as typeof activeDestinationField.field.schemaType
  }, [
    activeDestinationField,
    activeDestinationFieldName,
    hasFieldLevelLinkableSchemaTypes,
    hasFieldLevelReferenceFilterOptions,
    hasFieldLevelWeakReferences,
    linkableSchemaTypes,
    referenceFilterOptions,
    renderCustomLinkInput,
    weakReferences,
  ])

  const typeFieldSchemaType = useMemo(
    () => ({
      ...typeField?.field.schemaType,
      title: undefined,
      components: {
        ...typeField?.field.schemaType.components,
        input: renderLinkTypeInput,
      },
    }),
    [renderLinkTypeInput, typeField?.field.schemaType],
  )

  return (
    <Stack space={4}>
      {/* Render the text field if enabled */}
      {options?.enableText && textField && (
        <ObjectInputMember
          member={{
            ...textField,
            field: {
              ...textField.field,
              schemaType: textFieldSchemaType as unknown as typeof textField.field.schemaType,
            },
          }}
          {...renderProps}
        />
      )}

      <Stack space={3}>
        {/* Render a label for the link field if there's also a text field enabled. */}
        {/* If there's no text field, the label here is irrelevant */}
        {options?.enableText && (
          <Text as="label" weight="medium" size={1}>
            {options?.linkSectionLabel ?? 'Link'}
          </Text>
        )}

        <Flex gap={2} align="flex-start">
          {/* Render the type field (without its label) */}
          {typeField && (
            <ObjectInputMember
              member={{
                ...typeField,
                field: {
                  ...typeField.field,
                  schemaType: typeFieldSchemaType as unknown as typeof typeField.field.schemaType,
                },
              }}
              {...inlineFieldRenderProps}
            />
          )}

          <Stack space={2} style={fullWidthStyle}>
            {/* Render the input for the selected type of link (without its label) */}
            {activeDestinationField && linkFieldSchemaType && (
              <ObjectInputMember
                member={{
                  ...activeDestinationField,
                  field: {
                    ...activeDestinationField.field,
                    schemaType: linkFieldSchemaType,
                  },
                }}
                {...inlineFieldRenderProps}
              />
            )}

            {/* Render any validation errors for the link field */}
            {linkFieldValidation.length > 0 && (
              <Box style={validationBoxStyle}>
                <FormFieldValidationStatus
                  fontSize={1}
                  placement="top"
                  validation={linkFieldValidation}
                />
              </Box>
            )}
          </Stack>
        </Flex>

        {/* Render the description of the selected link field, if any */}
        {description && (
          <Text muted size={1}>
            {description}
          </Text>
        )}
      </Stack>

      {/* Render the rest of the fields as usual */}
      {otherFields.map((field) => (
        <ObjectInputMember key={field.key} member={field} {...renderProps} />
      ))}
    </Stack>
  )
})
