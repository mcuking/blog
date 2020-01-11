const path = require('path')

module.exports = {
  entry: {
    'mini-redux': path.resolve(__dirname, '../src/mini-redux.js'),
    'mini-react-redux': path.resolve(__dirname, '../src/mini-react-redux.js'),
    'mini-redux-thunk': path.resolve(__dirname, '../src/mini-redux-thunk.js'),
    'mini-redux-arrThunk': path.resolve(__dirname, '../src/mini-redux-arrThunk.js'),
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, '../dist'),
    publicPath: '',
    library: ['MiniRedux', '[name]'],
    libraryTarget: 'umd'
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