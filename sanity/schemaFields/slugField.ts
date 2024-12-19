import {defineField} from 'sanity'

const isValidSlug = (slug?: string): boolean => {
  if (!slug) return false
  const slugRegex = /^[a-z0-9-]+$/
  return slugRegex.test(slug) && slug.length <= 200
}

export const slugField = defineField({
  name: 'slug',
  title: 'Slug',
  type: 'slug',
  description: 'Note: use the same slug for all translations of this document.',
  options: {
    maxLength: 100,
    source: 'title',
    slugify: (input) => input.toLowerCase().replace(/\s+/g, '-').slice(0, 200),
  },
  validation: (rule) =>
    rule
      .required()
      .custom((slug) =>
        isValidSlug(slug?.current)
          ? true
          : 'Slug must be lowercase, contain only letters, numbers, and hyphens, and be 200 characters or less.',
      ),
})
