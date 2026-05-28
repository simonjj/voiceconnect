/* eslint-env node */
const fs = require('fs');
const path = require('path');
const glob = require('glob');
const extractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const pkg = require('../../package.json');

const mode = process.env.NODE_ENV || 'production';
const sourceMap = mode === 'development';
const themeVariables = require('../components/theme-variables');

process.env.NODE_CONFIG_DIR = path.resolve(__dirname, '../../main/config');
const config = require('config');

let babelrc = null;
try {
    babelrc = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, '../../.babelrc'), 'utf8')
    );
} finally {
    babelrc = { presets: ['@babel/react', '@babel/env'] };
}

const cssLoader = {
    loader: 'css-loader',
    options: {
        esModule: true,
        sourceMap,
        modules: {
            localIdentName: '[local]'
        }
    }
};

const extractLoader = {
    loader: extractPlugin.loader,
    options: {
        esModule: true
    }
};

const postcssLoader = {
    loader: 'postcss-loader',
    options: {
        postcssOptions: {
            plugins: [
                require('postcss-import'),
                require('precss')({
                    variables: themeVariables
                }),
                require('cssnano')
            ]
        }
    }
};

const sassLoader = {
    loader: 'sass-loader',
    options: {
        additionalData: `$color-primary: ${themeVariables['material-primary']}; $color-accent: ${themeVariables['material-accent']};`
    }
};

const entryPath = './renderer/entries';
const entry = Object.fromEntries(
    glob.sync(`${entryPath}/**/*.js`).map((file) => {
        const base = path.basename(file);
        const key = base.replace(path.extname(base), '');
        return [key, `./${path.join('entries', base)}`];
    })
);

module.exports = {
    context: path.resolve(__dirname, '../'),
    mode,
    target: 'web',
    devtool: false,
    entry,
    output: {
        path: path.resolve(__dirname, '../dist'),
        filename: '[name].bundle.js',
        publicPath: ''
    },
    optimization: {
        splitChunks: {
            chunks: 'all',
            maxSize: 244000
        }
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                include: [/node_modules\/@touchto\/theme/, /renderer/],
                use: {
                    loader: 'babel-loader?compact=false',
                    options: babelrc
                }
            },
            {
                test: /\.scss$/,
                use: ['style-loader', cssLoader, sassLoader]
            },
            {
                test: /\.css$/,
                use: [extractLoader, cssLoader, postcssLoader]
            },
            {
                test: /\.(png|svg|jpg|gif|ico)$/,
                use: ['file-loader']
            }
        ]
    },
    plugins: [
        new extractPlugin({
            filename: 'app-[name].css',
            chunkFilename: 'app-[id].css'
        }),
        new webpack.DefinePlugin({
            APP_VERSION: JSON.stringify(pkg.version),
            NODE_ENV: JSON.stringify(process.env.NODE_ENV),
            config: JSON.stringify(config.app)
        }),
        ...Object.keys(entry).map((item) => {
            return new HtmlWebpackPlugin({
                inline: true,
                inject: 'body',
                filename: `${item}.html`,
                template: `./views/${item}.html`,
                chunks: [item]
            });
        })
    ],
    node: false
};
