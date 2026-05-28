/* eslint-env node */
const path = require('path');
const webpack = require('webpack');
const common = require('./common');
const { spawn } = require('child_process');

const electron = () => {
    console.log('Starting Main Process...');
    let additional =
        process.env.INSPECT && process.env.INSPECT.indexOf('electron') !== -1
            ? ['debug:electron']
            : ['electron'];
    spawn('npm', ['run', ...additional], {
        shell: true,
        env: process.env,
        stdio: 'inherit'
    })
        .on('close', (code) => process.exit(code))
        .on('error', (spawnError) => console.error(spawnError));
};

const styleLoader = {
    loader: 'style-loader',
    options: {
        esModule: true
    }
};

module.exports = {
    ...common,
    mode: 'development',
    devServer: {
        contentBase: path.resolve(__dirname, '../dist'),
        hot: true,
        writeToDisk: true,
        after() {
            if (process.env.START_HOT == 1) setTimeout(electron, 4000);
        }
    },
    module: {
        rules: common.module.rules.map((r) => {
            if (r.test.toString().indexOf('css') !== -1) {
                r.use = [styleLoader, ...r.use.slice(1)];
            }
            return r;
        })
    },
    devtool: 'eval-source-map',
    plugins: [
        new webpack.HotModuleReplacementPlugin(),
        ...common.plugins.slice(1)
    ]
};
