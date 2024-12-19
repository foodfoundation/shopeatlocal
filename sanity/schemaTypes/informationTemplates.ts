import {CheckmarkCircleIcon, TextIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'
import {contentField} from '../schemaFields/contentField'

export const informationTemplates = defineType(
  {
    name: 'informationTemplates',
    title: 'Information Templates',
    type: 'document',
    options: {
      singleton: true,
    },
    icon: TextIcon,
    fields: [
      defineField({
        title: 'Information Templates',
        description: `This document contains the information templates used in the application`,
        name: 'staticPageNote',
        type: 'note',
        options: {
          icon: CheckmarkCircleIcon,
          tone: 'positive',
        },
      }),
      contentField({
        name: 'memberRegistrationText',
        title: 'Member registration text',
        description: 'Welcome text to display on the member registration page',
      }),
      defineField({
        name: 'shoppingCartInformationText',
        title: 'Shopping cart information text - optional',
        type: 'text',
      }),
    ],
  },
  {strict: false},
)
