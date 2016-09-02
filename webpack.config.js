const path = require('path')

module.exports = {
  entry: {
    reenact: ['./src/index.js'],
    ex1: ['./examples/ex1.js'],
  },
  output: {
    filename: "[name].bundle.js",
    chunkFilename: '[id].bundle.js',
    path: path.join(__dirname, './dist'),
    publicPath: path.join(__dirname, './dist/'),
    library: 'reenact',
    libraryTarget: 'umd'
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: "babel",
        query: {
          presets: [
            'es2015', 'stage-1',
          ],
          plugins: [
            ['transform-react-jsx', { "pragma": "Reenact.createElement" }]
          ]
        }
      }
    ]
  },
  devServer: {
    contentBase: './',
    hot: true,
  },
};
