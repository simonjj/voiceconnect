/* istanbul ignore file */
const path = require('path');
const { BrowserWindow } = require('electron');
const debug = require('debug')('ttc:main:knock');
const checkInspect = require('../utils/checkInspect');

const { windowOptions } = require('../lib/browserWindow');
const { appStore } = require('../lib/MemoryStore');

let win = null;
const generateKnockWindow = (parent, view = 'renderer/dist/knock.html') => {
    if (win !== null) return win;

    win = new BrowserWindow({
        width: 250,
        height: 250,
        // transparent: true,
        skipTaskbar: true,
        resizeable: false,
        frame: false,
        show: false,
        alwaysOnTop: true,
        webPreferences: {
            nodeIntegration: false,
            enableRemoteModule: false,
            preload: path.resolve(__dirname, '../../renderer/preload/base.js'),
            contextIsolation: true
        }
    });
    win.setMenu(null);
    win.setSkipTaskbar(true);
    win.setResizable(false);

    win.slug = 'knock';
    win.loadFile(view);

    win.once('closed', () => {
        win = null;
    });
    win.on('close', (e) => {
        e.preventDefault();
        win.hide();
    });
    win.on('show', () => {
        win.visible = true;
    });

    checkInspect(win);

    return win;
};

const getKnockWindow = () => {
    if (win) return win;

    return generateKnockWindow();
};

module.exports = {
    generateKnockWindow,
    getKnockWindow
};
