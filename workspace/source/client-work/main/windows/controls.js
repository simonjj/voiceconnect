/* istanbul ignore file */
const path = require('path');
const { ipcMain, BrowserWindow } = require('electron');
const checkInspect = require('../utils/checkInspect');

const { windowOptions } = require('../lib/browserWindow');
const { appStore } = require('../lib/MemoryStore');

let win = null;
const generateControlsWindow = () => {
    if (win !== null) return win;

    win = new BrowserWindow({
        width: 800,
        height: 450,
        webPreferences: {
            ...windowOptions.webPreferences,
            preload: path.resolve(__dirname, '../../renderer/preload/base.js'),
            contextIsolation: true
        }
    });

    win.slug = 'controls';
    win.loadFile('renderer/dist/controls.html');
    appStore.subscribe(win);

    win.once('close', () => {
        appStore.unsubscribe(win);
        win = null;
    });

    checkInspect(win);

    return win;
};

module.exports = {
    generateControlsWindow
};
