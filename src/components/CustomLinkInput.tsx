import {Select, Spinner, Text} from '@sanity/ui'
import {memo, useMemo} from 'react'
import {SanityDocument, set, type StringInputProps, useFormValue, useWorkspace} from 'sanity'
import useSWR from 'swr'

import {CustomLinkType, CustomLinkTypeOptions, LinkValue} from '../types'

const errorTextStyle = {color: 'var(--card-critical-fg-color)'} as const
const spinnerStyle = {marginLeft: '0.5rem'} as const

/**
 * Custom input component used for custom link types.
 * Renders a dropdown with the available options for the custom link type.
 */
export const CustomLinkInput = memo(function CustomLinkInput(
  props: StringInputProps & {
    customLinkTypes: CustomLinkType[]
  },
) {
  const workspace = useWorkspace()
  const document = useFormValue([]) as SanityDocument
  const linkValue = useFormValue(props.path.slice(0, -1)) as LinkValue | null
  const customLinkType = linkValue
    ? props.customLinkTypes.find((type) => type.value === linkValue.type)
    : undefined
  const requestKey = useMemo(
    () =>
      customLinkType && !Array.isArray(customLinkType.options)
        ? [
            'sanity-plugin-link-field',
            'custom-link-options',
            customLinkType.value,
            props.path,
            document?._id,
            document?._rev,
            workspace.currentUser?.id,
          ]
        : null,
    [customLinkType, document?._id, document?._rev, props.path, workspace.currentUser?.id],
  )

  const {
    data: asyncOptions,
    error,
    isLoading,
  } = useSWR<CustomLinkTypeOptions[]>(
    requestKey,
    () =>
      customLinkType && !Array.isArray(customLinkType.options)
        ? customLinkType.options(document, props.path, workspace.currentUser)
        : Promise.resolve([]),
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
    },
  )

  if (!customLinkType) return null

  const options = Array.isArray(customLinkType.options)
    ? customLinkType.options
    : asyncOptions || null

  if (error) {
    return (
      <Text size={1} style={errorTextStyle}>
        Failed to load options
      </Text>
    )
  }

  return options ? (
    <Select
      value={props.value ?? ''}
      onChange={(e) => {
        props.onChange(set(e.currentTarget.value || ''))
      }}
    >
      <>
        <option value="" disabled hidden />
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.title}
          </option>
        ))}
      </>
    </Select>
  ) : isLoading ? (
    <Spinner style={spinnerStyle} />
  ) : null
})
