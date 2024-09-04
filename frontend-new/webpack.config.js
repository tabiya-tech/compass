const { sentryWebpackPlugin } = require("@sentry/webpack-plugin");

const { getSentryAuthToken } = require("./src/envService");

module.exports = {
  // ... other options
  devtool: "source-map", // Source map generation must be turned on
  plugins: [// Put the Sentry Webpack plugin after all other plugins
  sentryWebpackPlugin({
    authToken: getSentryAuthToken(),
    org: "tabiya",
    project: "javascript-react",
  }), sentryWebpackPlugin({
    authToken: getSentryAuthToken(),
    org: "tabiya",
    project: "javascript-react"
  })],
}