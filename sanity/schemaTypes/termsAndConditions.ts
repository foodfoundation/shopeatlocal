import {BookIcon, WarningOutlineIcon} from '@sanity/icons'
import {contentField} from '../schemaFields/contentField'
import {defineField, defineType} from 'sanity'

export const termsAndConditionsPage = defineType(
  {
    name: 'termsAndConditionsPage',
    title: 'Terms and Conditions Page',
    type: 'document',
    options: {
      singleton: true,
    },
    icon: BookIcon,
    fields: [
      defineField({
        name: 'title',
        title: 'Terms and Conditions Title',
        type: 'string',
        description: 'Title of the terms and conditions page',
      }),
      defineField({
        title: 'Note!',
        description: 'Either fill out the content field or the external URL field',
        name: 'termsOfServiceNote',
        type: 'note',
        options: {
          icon: WarningOutlineIcon,
          tone: 'caution',
        },
      }),
      defineField({
        name: 'externalUrl',
        title: 'Terms Of Service External Page',
        description: 'External Website address for your terms of service',
        type: 'url',
        validation: (Rule) =>
          Rule.uri({
            scheme: ['http', 'https'],
            allowRelative: false,
          }),
      }),
      contentField({
        name: 'content',
        title: 'Terms and Conditions Content',
        description: 'Content of the terms and conditions page',
      }),
    ],
  },
  {strict: false},
)
