import {BookIcon, CheckmarkCircleIcon, EarthGlobeIcon} from '@sanity/icons'
import {contentField} from '../schemaFields/contentField'
import {defineField, defineType} from 'sanity'

export const productTypesPage = defineType(
  {
    name: 'productTypesPage',
    title: 'Product Types Page',
    type: 'document',
    options: {
      singleton: true,
    },
    icon: EarthGlobeIcon,
    fields: [
      defineField({
        title: 'Tip!',
        description: `This page is optional.
         Either fill out the content field or the external URL field.
         If either is filled out the link will be shown in the navigation header and within the "product type selector".
         `,
        name: 'productTypesNote',
        type: 'note',
        options: {
          icon: CheckmarkCircleIcon,
          tone: 'positive',
        },
      }),
      defineField({
        name: 'title',
        title: 'Product Types Title',
        type: 'string',
        description: 'Title of the terms and conditions page',
      }),
      defineField({
        name: 'externalUrl',
        title: 'Product Types External Page',
        description: 'External Website address for your product types page',
        type: 'url',
        validation: (Rule) =>
          Rule.uri({
            scheme: ['http', 'https'],
            allowRelative: false,
          }),
      }),
      contentField({
        name: 'content',
        title: 'Product Types Content',
        description: 'Content of the product types page',
      }),
    ],
  },
  {strict: false},
)
