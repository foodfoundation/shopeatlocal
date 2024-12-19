import {EnvelopeIcon} from '@sanity/icons'
import {defineField} from 'sanity'

export const emailContentField = ({
  name,
  title,
  description,
  fieldset,
}: {
  name: string
  title: string
  description?: string
  fieldset?: string
}) =>
  defineField({
    name,
    title,
    description,
    fieldset,
    type: 'array',
    of: [
      {
        type: 'block',
        styles: [
          {title: 'Heading 1', value: 'h1'},
          {title: 'Heading 2', value: 'h2'},
          {title: 'Heading 3', value: 'h3'},
          {title: 'Normal', value: 'normal'},
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
                  validation: (rule) =>
                    rule
                      .uri({
                        scheme: ['http', 'https'],
                        allowRelative: false,
                      })
                      .required(),
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
            {
              type: 'textColor',
            },
            {
              type: 'highlightColor',
            },
          ],
        },
      },
    ],
  })
