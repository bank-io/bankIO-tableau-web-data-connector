"use strict";

const webpack = require("webpack");
var HtmlWebpackPlugin = require('html-webpack-plugin');
var path = require('path');

module.exports = {
  entry: { index: "./src/bankio.js" },
  output: {
    filename: "[name].[hash].js", // <-- Important
  },
  target: "web", // <-- Important,
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: "babel-loader",
          options: {
              "plugins": ["@babel/plugin-transform-modules-commonjs"],
            presets: [
              [
                "@babel/preset-env",
                {
                  targets: {
                    esmodules: true,
                  },
                },
              ],
            ],
          },
        },
      },
      {
        test: /\.gql$/i,
        use: "raw-loader",
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
  },
  plugins: [new HtmlWebpackPlugin({
    template: 'src/index.html'
  })]
};
