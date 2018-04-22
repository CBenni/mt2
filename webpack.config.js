const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');

/* global __dirname */
function config(env) {
  return {
    entry: ['babel-polyfill', './src/js/index.js'], // './src/index.js'],
    output: {
      path: path.resolve(__dirname, `dist/${env}`),
      publicPath: '/',
      filename: '[name].[chunkhash].js'
    },
    devtool: 'source-map',
    module: {
      rules: [
        {
          test: /ui-sortable/,
          use: ['imports-loader?$UI=jquery-ui/ui/widgets/sortable']
        },
        {
          test: /draggable/,
          use: ['imports-loader?$UI=jquery-ui/ui/widgets/draggable']
        },
        {
          test: /\.js$/,
          exclude: /node_modules(?!\/webpack-dev-server)/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['env'],
              plugins: ['angularjs-annotate', 'babel-polyfill']
            }
          }
        },
        {
          test: /templates/,
          use: 'raw-loader'
        },
        {
          test: /html\/\w+\.html$/,
          use: ['file-loader?name=pages/[name].[ext]'],
          exclude: path.resolve(__dirname, 'src/html/index.html')
        },
        {
          test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
          loader: 'url-loader'
        },
        {
          test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/,
          loader: 'url-loader'
        },
        {
          test: /\.scss$/,
          use: [{
            loader: 'style-loader' // creates style nodes from JS strings
          }, {
            loader: 'css-loader' // translates CSS into CommonJS
          }, {
            loader: 'sass-loader' // compiles Sass to CSS
          }]
        },
        {
          test: /\.less$/,
          use: [{
            loader: 'style-loader' // creates style nodes from JS strings
          }, {
            loader: 'css-loader' // translates CSS into CommonJS
          }, {
            loader: 'less-loader' // compiles Less to CSS
          }]
        }
      ]
    },
    plugins: [
      new CleanWebpackPlugin([`dist/${env}`]),
      new HtmlWebpackPlugin({ template: './src/html/index.html' }),
      new ExtractTextPlugin({
        filename: '[name].[contenthash].css',
        disable: env === 'development'
      }),
      new CopyWebpackPlugin([{ from: './src/assets', to: 'assets' }], {
        devServer: {
          outputPath: path.join(__dirname, 'dist/assets')
        }
      }),
      new webpack.ProvidePlugin({
        'window.jQuery': 'jquery'
      })
    ]
  };
}

module.exports = config;
