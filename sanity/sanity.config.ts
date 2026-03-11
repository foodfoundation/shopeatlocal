import {table} from '@sanity/table'
import {visionTool} from '@sanity/vision'
import {defineConfig} from 'sanity'
import {noteField} from 'sanity-plugin-note-field'
import {simplerColorInput} from 'sanity-plugin-simpler-color-input'
import {singletonTools} from 'sanity-plugin-singleton-tools'
import {structureTool} from 'sanity/structure'
import {schemaTypes} from './schemaTypes'

export default defineConfig({
  name: 'cultivativeDemo',
  title: 'Cultivative Demo',

  projectId: process.env.SANITY_STUDIO_API_PROJECT_ID ?? '',
  dataset: process.env.SANITY_STUDIO_API_DATASET ?? '',

  plugins: [
    structureTool(),
    visionTool(),
    singletonTools(),
    simplerColorInput({
      // Note: These are all optional
      defaultColorFormat: 'rgba',
      defaultColorList: [
        {label: 'Red', value: '#FF0000'},
        {label: 'Blue', value: '#0000FF'},
        {label: 'Green', value: '#008000'},
        {label: 'Yellow', value: '#FFFF00'},
        {label: 'Orange', value: '#FFA500'},
        {label: 'Purple', value: '#800080'},
        {label: 'Pink', value: '#FFC0CB'},
        {label: 'Brown', value: '#A52A2A'},
        {label: 'Gray', value: '#808080'},
        {label: 'Black', value: '#000000'},
        {label: 'White', value: '#FFFFFF'},
        {label: 'Cyan', value: '#00FFFF'},
        {label: 'Magenta', value: '#FF00FF'},
        {label: 'Lime', value: '#00FF00'},
        {label: 'Indigo', value: '#4B0082'},
        {label: 'Teal', value: '#008080'},
        {label: 'Maroon', value: '#800000'},
        {label: 'Olive', value: '#808000'},
        {label: 'Navy', value: '#000080'},
        {label: 'Gold', value: '#FFD700'},
        {label: 'Silver', value: '#C0C0C0'},
        {label: 'Custom...', value: 'custom'},
      ],
      enableSearch: true,
    }),
    table(),
    noteField(),
  ],

  schema: {
    types: schemaTypes,
  },
})
