import {HomeIcon} from '@sanity/icons'
import {defineType} from 'sanity'
import {
  emailAddressesFields,
  externalWebsitesFields,
  mainImages,
  mainInfoFileds,
  socialMediaFields,
} from '../schemaFields/coopDetailsFields'

export const coopDetails = defineType(
  {
    name: 'coopDetails',
    title: 'Market Details',
    type: 'document',
    options: {
      singleton: true,
    },
    icon: HomeIcon,
    fieldsets: [
      {
        title: 'Main Info',
        name: 'mainInfo',
        options: {collapsible: true, collapsed: false},
      },
      {
        title: 'Main Images',
        name: 'mainImages',
        options: {collapsible: true, collapsed: true},
      },
      {
        title: 'Email addresses',
        name: 'emailAddresses',
        options: {collapsible: true, collapsed: true},
      },
      {
        title: 'External Websites',
        name: 'externalWebsites',
        options: {collapsible: true, collapsed: true},
      },
      {
        title: 'Social Media',
        name: 'socialMedia',
        options: {collapsible: true, collapsed: true},
      },
    ],
    fields: [
      ...mainInfoFileds,
      ...emailAddressesFields,
      ...externalWebsitesFields,
      ...mainImages,
      ...socialMediaFields,
    ],
  },
  {strict: false},
)
