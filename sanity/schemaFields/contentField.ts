import {EnvelopeIcon, RemoveIcon, PanelLeftIcon, PanelRightIcon} from '@sanity/icons'
import {defineField} from 'sanity'

export const contentField = ({
  name,
  title,
  description,
}: {
  name: string
  title: string
  description?: string
}) =>
  defineField({
    name,
    title,
    description,
    type: 'array',
    of: [
      {
        type: 'block',
        styles: [
          {title: 'Heading 1', value: 'h1'},
          {title: 'Heading 2', value: 'h2'},
          {title: 'Normal', value: 'normal'},
          {title: 'Small', value: 'small'},
        ],
        marks: {
          decorators: [
            {title: 'Strong', value: 'strong'},
            {title: 'Emphasis', value: 'em'},
            {title: 'Underline', value: 'underline'},
          ],
          annotations: [
            {
              name: 'link',
              title: 'External link',
              type: 'object',
              fields: [
                {
                  name: 'href',
                  type: 'url',
                  title: 'URL',
                  validation: (rule) => rule.required(),
                },
              ],
            },
            {
              name: 'emailAddressContent',
              title: 'Email',
              type: 'object',
              icon: EnvelopeIcon,
              fields: [
                {
                  name: 'emailAdd',
                  type: 'string',
                  title: 'Email',
                  validation: (rule) =>
                    rule.required().email().error('Please enter a valid email address'),
                },
              ],
            },
          ],
        },
      },
      {
        name: 'break',
        type: 'object',
        title: 'Divider',
        description: 'A horizontal line to separate content',
        icon: RemoveIcon,
        fields: [
          {
            name: 'style',
            type: 'string',
            options: {
              list: ['divider'],
            },
          },
        ],
      },
      {
        name: 'image',
        title: 'Image',
        type: 'image',
        options: {
          accept: 'image/png, image/jpeg, image/webp',
        },
        fields: [
          {
            name: 'alt',
            type: 'string',
            title: 'Alternative Text',
            description: 'Short description of the image for accessibility purposes.',
            validation: (rule) => rule.required(),
          },
        ],
      },
      {
        name: 'table',
        title: 'Table',
        type: 'object',
        fields: [{name: 'table', type: 'table'}],
      },
    ],
  })
