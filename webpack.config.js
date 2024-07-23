'use strict';

const path = require('path');
const webpack = require('webpack');

/** @type {import('webpack').Configuration} */
const config = {
  target: 'node', // VS Code extensions run in Node.js environment, change this if you are targeting a different environment

  entry: './src/extension.js', // Entry point of the extension
  output: {
    path: path.resolve(__dirname, 'dist'), // Output directory
    filename: 'extension.js', // Output file
    libraryTarget: 'commonjs2', // CommonJS2 module format
    devtoolModuleFilenameTemplate: '../[resource-path]' // For source maps
  },
  devtool: 'source-map', // Generate source maps for development
  externals: {
    vscode: 'commonjs vscode' // Exclude vscode module from bundle
  },
  resolve: {
    // Configure how modules are resolved
    mainFields: ['browser', 'module', 'main'], // Look for `browser`, `module`, then `main` entry points in node modules
    extensions: ['.js'], // Resolve JavaScript files
    alias: {
      // Optional: Add path aliasing if needed
    },
    fallback: {
      // Optional: Provide fallbacks for core Node.js modules if needed
    }
  },
  module: {
    rules: [
      {
        test: /\.js$/, // Process JavaScript files
        exclude: /node_modules/, // Exclude node_modules directory
        use: {
          loader: 'babel-loader', // Use Babel for JavaScript transpiling (optional)
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
    })
  ]
};

module.exports = config;
