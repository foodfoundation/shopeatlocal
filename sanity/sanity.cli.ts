import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_API_PROJECT_ID,
    dataset: process.env.SANITY_STUDIO_API_DATASET,
  },
  /**
   * Enable auto-updates for studios.
   * Learn more at https://www.sanity.io/docs/cli#auto-updates
   */
  autoUpdates: false,
  studioHost: process.env.SANITY_STUDIO_HOST ?? '',
})
