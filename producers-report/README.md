# Reports App

A simple React application that utilizes [react-filterable-table](https://www.npmjs.com/package/react-filterable-table) to visualize a set of JSON data.

Initially built to visualize Producer data for the ShopEatLocal shopping application, but this app can be used to visualize any arbitrary JSON data as described in the above NPM package.

To simplify consumption of this application, it is designed to be bundled with `npm run build`, then deployed to a CDN to be consumed as a single Javascript module. The consuming application should pass the data to be visualized on window.ProducerData. (This can be improved by converting Producer Data as a top level React prop and exposing a render function which accepts those props)

# Development

```
npm install
npm dev
```

Mock data is already defined in the index.html. Feel free to change it for your development needs.

# Deployment

## How to use the JS bundle?

When a user opens the _Reports_ tab, a simple HTML page is served which contains a script tag who's src points to the bundle.

When we want to release changes to the Reports App, we must upload a new `index.js`.

## Generate and serve the bundle

Generate the bundle:
`npm run build`

The resulting bundles can be found in `dist/assets/`.

Copy the bundle to the Static folder of the app with the following command:

```
npm run release:static
```

Or upload it to the place where you are serving static assets for the application.
