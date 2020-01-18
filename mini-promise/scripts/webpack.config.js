const path = require('path')

module.exports = {
  entry: path.resolve(__dirname, '../src/index.js'),
  output: {
    filename: 'mini-promise.js',
    path: path.resolve(__dirname, '../dist'),
    publicPath: '',
    library: 'MiniPromise',
    libraryTarget: 'commonjs2'
  },

  module: {
    rules: [
      {
        test: /\.js?$/,
        exclude: /(node_modules)/,
        loader: 'babel-loader'
      }
    ]
  }
}