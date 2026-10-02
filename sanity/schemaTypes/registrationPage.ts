import {CheckmarkCircleIcon, TextIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'
import {contentField} from '../schemaFields/contentField'

export const registrationPage = defineType(
  {
    name: 'registrationPage',
    title: 'Registration Page',
    type: 'document',
    options: {
      singleton: true,
    },
    icon: TextIcon,
    fields: [
      defineField({
        title: 'Registration Page',
        description: `This document contains the registration page information`,
        name: 'registrationPageNote',
        type: 'note',
        options: {
          icon: CheckmarkCircleIcon,
          tone: 'positive',
        },
      }),
      contentField({
        name: 'memberRegistrationTextJoinNow',
        title: 'Member registration text for join now',
        description: 'Welcome text to display on the member registration page for join now',
      }),
      contentField({
        name: 'memberRegistrationTextTrialMembership',
        title: 'Member registration text for trial membership',
        description: 'Welcome text to display on the trial membership registration page',
      }),
      contentField({
        name: 'memberRegistrationTextChoicePage',
        title: 'Member registration text for "Join now" or "Trial membership" choice page',
        description: 'Welcome text to display on the "Join now" or "Trial membership" choice page',
      }),
      defineField({
        name: 'memberRegistrationChoicePageJoinNowButtonText',
        title: 'Member registration choice page "Join now" button text',
        description: 'Text for the "Join now" button on the "Join now" or "Trial membership" choice page',
        type: 'string',
        validation: (Rule) => Rule.max(20).error('Text is too long'),
      }),
      defineField({
        name: 'memberRegistrationChoicePageJoinNowButtonExplanationText',
        title: 'Member registration choice page "Join now" button explanation text',
        description: 'Explanation text for the "Join now" button on the "Join now" or "Trial membership" choice page',
        type: 'string',
        validation: (Rule) => Rule.max(100).error('Text is too long'),
      }),
      defineField({
        name: 'memberRegistrationChoicePageTrialMembershipButtonText',
        title: 'Member registration choice page "Trial membership" button text',
        description: 'Text for the "Trial membership" button on the "Join now" or "Trial membership" choice page',
        type: 'string',
        validation: (Rule) => Rule.max(20).error('Text is too long'),
      }),
      defineField({
        name: 'memberRegistrationChoicePageTrialMembershipButtonExplanationText',
        title: 'Member registration choice page "Trial membership" button explanation text',
        description: 'Explanation text for the "Trial membership" button on the "Join now" or "Trial membership" choice page',
        type: 'string',
        validation: (Rule) => Rule.max(100).error('Text is too long'),
      }),
      defineField({
        name: 'memberRegistrationJoinNowSubmitButtonText',
        title: 'Member registration "Join now" submit button text',
        description: 'Text for the submit button on the "Join now" registration page',
        type: 'string',
        validation: (Rule) => Rule.max(40).error('Text is too long'),
      }),
      defineField({
        name: 'memberRegistrationTrialMembershipSubmitButtonText',
        title: 'Member registration "Trial membership" submit button text',
        description: 'Text for the submit button on the trial membership registration page',
        type: 'string',
        validation: (Rule) => Rule.max(40).error('Text is too long'),
      }),
    ],
  },
  {strict: false},
)
