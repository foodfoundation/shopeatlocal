import {TextIcon} from '@sanity/icons'
import {defineType} from 'sanity'
import {contentField} from '../schemaFields/contentField'

export const producer = defineType(
  {
    name: 'producer',
    title: 'Producer',
    type: 'document',
    options: {
      singleton: true,
    },
    icon: TextIcon,
    fields: [
      contentField({
        name: 'registrationTerms',
        title: 'Registration Terms',
        description:
          'Terms shown on the producer registration form.',
      }),
    ],
  },
  {strict: false},
)
