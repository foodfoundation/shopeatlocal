import {defineField} from 'sanity'

export const mainInfoFileds = [
  defineField({
    name: 'CoopName',
    title: 'Market Name',
    type: 'string',
    fieldset: 'mainInfo',
    description:
      'The name of your market will be displayed in multiple pages on the site, such as the home page.',
    validation: (Rule) => Rule.required(),
  }),
  defineField({
    name: 'CoopNameShort',
    title: 'Short Market Name',
    description:
      'Abbreviated version of your market, typically 3-5 characters. This will be used in places where text space is limited on the site.',
    type: 'string',
    fieldset: 'mainInfo',
    validation: (Rule) => Rule.required(),
  }),
  defineField({
    name: 'CoopNameBusiness',
    title: 'Market Business Name',
    description:
      'Official business name of your market, this will show up in the footer and contact forms.',
    type: 'string',
    fieldset: 'mainInfo',
    validation: (Rule) => Rule.required(),
  }),
  defineField({
    name: 'Phone',
    title: 'Phone',
    description: 'Phone number of your market.',
    type: 'string',
    fieldset: 'mainInfo',
    validation: (Rule) => Rule.required(),
  }),
  defineField({
    name: 'AddressLine1',
    title: 'Address Line 1',
    description: 'First line of your market address.',
    type: 'string',
    fieldset: 'mainInfo',
    validation: (Rule) => Rule.required(),
  }),
  defineField({
    name: 'AddressLine2',
    title: 'Address Line 2',
    description: 'Second line of your market address.',
    type: 'string',
    fieldset: 'mainInfo',
    validation: (Rule) => Rule.required(),
  }),
  defineField({
    name: 'GeneralManager',
    title: 'General Manager',
    description: 'Name of the general manager of your market.',
    type: 'string',
    fieldset: 'mainInfo',
    validation: (Rule) => Rule.required(),
  }),
  defineField({
    name: 'GeneralManagerTitle',
    title: 'General Manager Title',
    description: 'Title of the general manager of your market.',
    type: 'string',
    fieldset: 'mainInfo',
    validation: (Rule) => Rule.required(),
  }),
]

export const emailAddressesFields = [
  defineField({
    name: 'HelpEmail',
    title: 'Help Email',
    description: 'Email address for help and support.',
    type: 'string',
    fieldset: 'emailAddresses',
    validation: (Rule) => Rule.required().email().error('Please enter a valid email address'),
  }),
  defineField({
    name: 'InfoEmail',
    title: 'Info Email',
    description: 'Email address for general information.',
    type: 'string',
    fieldset: 'emailAddresses',
    validation: (Rule) => Rule.required().email().error('Please enter a valid email address'),
  }),
  defineField({
    name: 'SenderEmail',
    title: 'Sender Email',
    description: 'Email address that the site can use to send emails on your behalf.',
    type: 'string',
    fieldset: 'emailAddresses',
    validation: (Rule) => Rule.required().email().error('Please enter a valid email address'),
  }),
  defineField({
    name: 'SenderEmailDisplayName',
    title: 'Sender Email Display Name',
    description: 'Display name of the email that the site can use to send emails on your behalf.',
    type: 'string',
    fieldset: 'emailAddresses',
    validation: (Rule) => Rule.required().email().error('Please enter a valid email address'),
  }),
  defineField({
    name: 'MembershipNotificationEmail',
    title: 'Membership Notification Email',
    description: 'Email address for membership notifications to send on your behalf.',
    type: 'string',
    fieldset: 'emailAddresses',
    validation: (Rule) => Rule.required().email().error('Please enter a valid email address'),
  }),
  defineField({
    name: 'PaypalEmail',
    title: 'Paypal Email',
    description: 'Email address for your Paypal account.',
    type: 'string',
    fieldset: 'emailAddresses',
    validation: (Rule) => Rule.email().error('Please enter a valid email address'),
  }),
]

export const externalWebsitesFields = [
  defineField({
    name: 'HomeWebsite',
    title: 'Home Website',
    description: 'Website address for your market. This is not the shopping page website.',
    type: 'url',
    fieldset: 'externalWebsites',
    validation: (Rule) =>
      Rule.uri({
        scheme: ['http', 'https'],
        allowRelative: false,
      }),
  }),
  defineField({
    name: 'PickupWebsite',
    title: 'Pick Up Information Page',
    description: 'Website address for pick up locations, dates, time and details.',
    type: 'url',
    fieldset: 'externalWebsites',
    validation: (Rule) =>
      Rule.uri({
        scheme: ['http', 'https'],
        allowRelative: false,
      }),
  }),
  defineField({
    name: 'CalendarWebsite',
    title: 'Calendar Website',
    description: 'Website address for your calendar of operations.',
    type: 'url',
    fieldset: 'externalWebsites',
    validation: (Rule) =>
      Rule.uri({
        scheme: ['http', 'https'],
        allowRelative: false,
      }),
  }),
  defineField({
    name: 'TermsOfServiceWebsite',
    title: 'Terms Of Service Website',
    description:
      'Website address for your terms of service. If not set, fill out the terms of service filed.',
    type: 'url',
    fieldset: 'externalWebsites',
    validation: (Rule) =>
      Rule.uri({
        scheme: ['http', 'https'],
        allowRelative: false,
      }),
  }),
  defineField({
    name: 'ProductStandardsWebsite',
    title: 'Product Standards Website',
    description: 'Website address for your product standards.',
    type: 'url',
    fieldset: 'externalWebsites',
    validation: (Rule) =>
      Rule.uri({
        scheme: ['http', 'https'],
        allowRelative: false,
      }),
  }),
  defineField({
    name: 'ProducerStandardsWebsite',
    title: 'Producer Standards Website',
    description:
      'Website address for your producer standards and information about your production practices. ',
    type: 'url',
    fieldset: 'externalWebsites',
    validation: (Rule) =>
      Rule.uri({
        scheme: ['http', 'https'],
        allowRelative: false,
      }),
  }),
]

export const mainImages = [
  defineField({
    name: 'FaviconPath',
    title: 'Favicon Path',
    description:
      'The favicon appears as the main icon in the browser tab. Best practise: use a square image converted to .ico format.',
    type: 'image',
    fieldset: 'mainImages',
    options: {
      accept: 'image/jpeg, image/png, image/svg+xml, image/x-icon',
    },
    validation: (Rule) => Rule.required(),
  }),
  defineField({
    name: 'HeaderLogoPath',
    title: 'Header Logo Image',
    description: 'Your header logo will be displayed at the top of your market website.',
    type: 'image',
    fieldset: 'mainImages',
    options: {
      accept: 'image/jpeg, image/png, image/svg+xml',
    },
    validation: (Rule) => Rule.required(),
  }),
  defineField({
    name: 'HeroLogoPath',
    title: 'Hero Logo Image',
    description: 'Your hero logo will be displayed on the landing page of the website.',
    type: 'image',
    fieldset: 'mainImages',
    options: {
      accept: 'image/jpeg, image/png, image/svg+xml',
    },
    validation: (Rule) => Rule.required(),
  }),
  defineField({
    name: 'FooterLogoPath',
    title: 'Footer Logo Image',
    description: 'Your footer logo will be displayed at the bottom of your market website.',
    type: 'image',
    fieldset: 'mainImages',
    options: {
      accept: 'image/jpeg, image/png, image/svg+xml',
    },
    validation: (Rule) => Rule.required(),
  }),
  defineField({
    name: 'TextLogoPath',
    title: 'Text Logo Image',
    description: 'Your text logo will be displayed at the top of your market website.',
    type: 'image',
    fieldset: 'mainImages',
    options: {
      accept: 'image/jpeg, image/png, image/svg+xml',
    },
    validation: (Rule) => Rule.required(),
  }),
  defineField({
    name: 'ProductLogoPath',
    title: 'Product Logo Image',
    description: 'Placeholder image for products that do not have an image.',
    type: 'image',
    fieldset: 'mainImages',
    options: {
      accept: 'image/jpeg, image/png, image/svg+xml',
    },
    validation: (Rule) => Rule.required(),
  }),
]

export const socialMediaFields = [
  defineField({
    name: 'FacebookUrl',
    title: 'Facebook URL',
    description: 'Your Facebook page address.',
    type: 'url',
    fieldset: 'socialMedia',
    validation: (Rule) =>
      Rule.uri({
        scheme: ['http', 'https'],
        allowRelative: false,
      }),
  }),
  defineField({
    name: 'InstagramUrl',
    title: 'Instagram URL',
    description: 'Your Instagram page address.',
    type: 'url',
    fieldset: 'socialMedia',
    validation: (Rule) =>
      Rule.uri({
        scheme: ['http', 'https'],
        allowRelative: false,
      }),
  }),
]
