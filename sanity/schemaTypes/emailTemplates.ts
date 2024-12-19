import {EnvelopeIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'
import {emailContentField} from '../schemaFields/emailContentField'

const defineBooleanField = ({
  name,
  fieldset,
  initialValue,
}: {
  name: string
  fieldset?: string
  initialValue?: boolean
}) =>
  defineField({
    name,
    title: 'Append footer to email',
    type: 'boolean',
    initialValue: initialValue ?? true,
    fieldset,
    description: 'Should the email footer be appended to this email?',
  })

const footerField = emailContentField({
  name: 'emailFooter',
  title: 'Email Footer',
  description: 'Footer content to be included in all emails',
})

const registrationEmailFields = [
  defineField({
    fieldset: 'registrationEmailFieldSet',
    name: 'registrationEmailSubject',
    title: 'Registration Email Subject',
    type: 'string',
  }),
  emailContentField({
    fieldset: 'registrationEmailFieldSet',
    name: 'registrationEmailContent',
    title: 'Registration Email Content',
    description: 'Email content to send to new members',
  }),
  defineBooleanField({
    fieldset: 'registrationEmailFieldSet',
    name: 'registrationEmailAppendFooter',
  }),
]

export const emailTemplates = defineType(
  {
    name: 'emailTemplates',
    title: 'Email Templates',
    type: 'document',
    options: {
      singleton: true,
    },
    icon: EnvelopeIcon,
    fieldsets: [
      {
        title: 'Registration Email',
        name: 'registrationEmailFieldSet',
        options: {collapsible: true, collapsed: false},
      },
    ],
    fields: [footerField, ...registrationEmailFields],
  },
  {strict: false},
)
