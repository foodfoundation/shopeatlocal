import {config} from '@repo/eslint-config/base'

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  {
    extends: ['@sanity/eslint-config-studio'],
  },
]
