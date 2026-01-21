const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const Dotenv = require("dotenv-webpack"); // 1. Import the plugin

module.exports = {
  mode: "development",
  devtool: "cheap-module-source-map",
  entry: {
    background: "./src/background.js",
    content: "./src/content.js",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    clean: true,
    module: true,
    // Ensure the output is compatible with Chrome's ES Module requirements
    environment: {
      module: true,
    },
  },
  experiments: {
    outputModule: true,
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        include: path.resolve(__dirname, "src"),
        type: "javascript/auto",
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              [
                "@babel/preset-env",
                {
                  modules: false,
                  targets: { chrome: "91" },
                },
              ],
            ],
            sourceType: "module",
          },
        },
      },
    ],
  },
  resolve: {
    extensions: [".js"],
  },
  plugins: [
    // 2. Add the Dotenv plugin here
    new Dotenv({
  path: path.resolve(__dirname, '.env'), // Absolute path to the .env file
  systemvars: true,                      // Loads system environment variables as well
  silent: false                          // This will show an error in your terminal if the .env is missing!
}),

    new CopyPlugin({
      patterns: [
        { from: "src/manifest.json", to: "." },
        { from: "src/rules.json", to: "." },
        { from: "src/options.html", to: "." },

        // Icon handling: copies from your dashboard's public folder to dist/icons
        {
          from: path.resolve(__dirname, "analyzeit-dashboard/public/icons"),
          to: "icons",
        },

        // Copies the built dashboard files
        {
          from: path.resolve(__dirname, "analyzeit-dashboard/dist"),
          to: "dashboard",
          noErrorOnMissing: false,
          force: true,
        },
      ],
    }),
  ],
};
