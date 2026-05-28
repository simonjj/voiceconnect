const HtmlWebpackPlugin = require('html-webpack-plugin');
const InlineChunkHtmlPlugin = require('react-dev-utils/InlineChunkHtmlPlugin');
const common = require('./common');

module.exports = {
    ...common,
    plugins: [
        ...common.plugins,
        new InlineChunkHtmlPlugin(HtmlWebpackPlugin, [/.js$/, /.css$/])
    ]
};
