const webpack = require('webpack');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';



const plugins = [
  new webpack.DefinePlugin({
    'process.env': {
      NODE_ENV: JSON.stringify(nodeEnv)
    }
  }),
  new HtmlWebpackPlugin({
    title: 'demo forge',
    filename: 'index.html',
    template: 'index.html',
    inject:false,
  }),
  /* new webpack.LoaderOptionsPlugin({
       options: {
           tslint: {
               emitErrors: false,
               failOnHint: false
           }
       }
   })*/
];



if(isProd){
  plugins.push(new UglifyJsPlugin());
}

var config = {
  devtool: 'source-map', //isProd ? 'hidden-source-map' :
  context: path.resolve('./src'),
  entry: {
    app: './index.js'
  },
  output: {
    path: path.resolve('./dist'),
    filename: function () {
      if(isProd){
        return '[name].bundle.js'
      };
      return '[name].bundle.src.js'
    }
  },
  module: {
    rules: [
      {
        enforce: 'pre',
        test: /\.js$/,
        exclude: [/\/node_modules\//],
        use: {
          loader: 'babel-loader',
        },
      },
     // {test: /\.html$/, loader: 'html-loader'},
      {test: /\.css$/, loaders: ['style-loader', 'css-loader']}
    ].filter(Boolean)
  },
  resolve: {
    extensions: ['.js']
  },
  plugins: plugins,
  devServer: {
    contentBase: path.join(__dirname, 'dist/'),
    compress: false,
    port: 3100,
    hot: true,
  }
};

module.exports = config;
