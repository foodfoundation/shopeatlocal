# Sanity Content Management System

The [Sanity CMS](https://www.sanity.io/docs/introduction/getting-started?utm_source=readme) is used to configure and manage shop content. Sanity is free to use, but it is essential to set up properly for a new shop instance.

## Prerequisites

TBD

## Setting Up the Configuration

Create a `.env` file in the `sanity` folder with the following content:

```
SANITY_STUDIO_API_PROJECT_ID=your-project-id
SANITY_STUDIO_API_DATASET=your-data-set // The default dataset is called 'production'
```

## Initial Setup and Deployment of Sanity Studio

To improve the user experience, Singleton schemas are implemented. This prevents users from creating multiple instances of certain schemas in the Sanity Studio. However, to set up these singletons for the first time, some additional preparation is required.

### 1. Disable Singleton Restrictions Temporarily

To create the initial instance of each schema, temporarily disable the singleton setting:

In the schemaTypes folder, update all schema types by setting `singleton: true` to `false`:

```ts
// Example
export const coopDetails = defineType({
  name: 'coopDetails',
  title: 'Market Details',
  type: 'document',
  options: {
    singleton: false, // Set this to false temporarily
  },
  ...
});
```

### 2. Run Sanity Studio locally and create the instances

Start the Sanity Studio locally:

```bash
npm run start
```

Access the Studio (default URL: http://localhost:3333/), and log in with the credentials used to create your Sanity project. Then, create the initial instance for each schema.

> ⚠️ Note:  
> Be sure to create only one instance per schema.

Complete all required fields—dummy data can be used if needed.

**Publish all changes once complete**.

### 3. Reinstate Singleton Settings

Once the initial instances are created, revert the singleton: false attributes to true in the schema files:

```ts
export const coopDetails = defineType({
  name: 'coopDetails',
  title: 'Market Details',
  type: 'document',
  options: {
    singleton: true, // Reset to true
  },
  ...
});
```

### 4. Deploy Sanity Studio to the Cloud

While self-hosting is possible, we recommend using Sanity’s free cloud hosting.

```bash
npm run deploy
```

Follow the instructions and specify a custom subdomain if desired - recommended.

### 5. Configure the Main Project

In the `Cfg.js` file, set up the Sanity section with your project configuration:

```js
exports.Sanity = {
  projectId: 'your-project-id',
  dataset: 'your-dataset-name', // 'production' by default
  baseUrl: 'https://your-domain.sanity.studio',
  apiVersion: '2021-10-21',
  useCdn: false,
}
```

## Setup Complete

🎉 Congratulations! 🎉
Your shop is now configured and ready to use.

To refresh the config data, simply make changes in the Sanity Studio, publish, and click “Refresh” on the Site Admin page.
