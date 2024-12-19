import {CheckmarkCircleIcon, HelpCircleIcon, WarningOutlineIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'
import {contentField} from '../schemaFields/contentField'
import {slugField} from '../schemaFields/slugField'

export const staticPages = defineType({
  name: 'staticPages',
  title: 'Static Pages',
  type: 'document',
  icon: HelpCircleIcon,
  fields: [
    defineField({
      title: 'Tip!',
      description: `This page is optional.
         Either fill out the content field or the external URL field.
         If either is filled out the link will be shown in the navigation header".
         `,
      name: 'staticPageNote',
      type: 'note',
      options: {
        icon: CheckmarkCircleIcon,
        tone: 'positive',
      },
    }),
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: 'Title of the page',
    }),
    slugField,
    defineField({
      name: 'linkTitle',
      title: 'Link Title',
      type: 'string',
      description: 'Title of the link in the navigation header',
      validation: (Rule) => Rule.max(20).required(),
    }),
    defineField({
      name: 'externalUrl',
      title: 'External URL',
      description: 'External Website address for your page',
      type: 'url',
      validation: (Rule) =>
        Rule.uri({
          scheme: ['http', 'https'],
          allowRelative: false,
        }),
    }),
    contentField({
      name: 'content',
      title: 'Help Page content',
      description: 'Content of the page',
    }),
  ],
})
