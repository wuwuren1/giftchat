const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    mode: 'development',
    entry: './index.js',
    output: {
        filename: 'index.js',
        path: path.resolve(__dirname, 'dist'),
    },
    module: {
        rules: [
            { test: /\.html$/, use: 'html-loader' },
            { test: /\.js$/, exclude: /node_modules/, use: 'babel-loader' },
        ],
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                { from: './index.html', to: 'index.html' },
                { from: './index.css', to: 'index.css' }
            ]
        })
    ],
    devServer: {
        static: {
            directory: path.join(__dirname, 'dist'), // where to serve static files from
        },
        compress: true, // enable gzip compression
        port: 3000, // port to run the server on
    },
};