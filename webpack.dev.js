const merge = require("webpack-merge");
const common = require("./webpack.common.js");
var path = require('path');

module.exports = merge(common, {
  mode: "development",
  watch: true,
  devtool: "inline-source-map",
  devServer: {
    contentBase: path.join(__dirname, 'dist'),
    compress: true,
    port: 3333
  }
});
