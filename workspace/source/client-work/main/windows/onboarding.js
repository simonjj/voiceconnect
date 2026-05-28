/* istanbul ignore file */
const path = require('path');
const { BrowserWindow } = require('electron');
const checkInspect = require('../utils/checkInspect');

const { appStore } = require('../lib/MemoryStore');

let win = null;
const generateOnboardingWindow = () => {
    if (win !== null) return win;

    win = new BrowserWindow({
        width: 600,
        height: 400,
        frame: false,
        alwaysOnTop: true,
        resizeable: false,
        skipTaskbar: true,
        webPreferences: {
            nodeIntegration: false,
            enableRemoteModule: false,
            preload: path.resolve(__dirname, '../../renderer/preload/base.js'),
            contextIsolation: true
        }
    });

    win.setMenu(null);
    win.slug = 'onboarding';
    win.loadFile('renderer/dist/onboarding.html');
    appStore.subscribe(win);
    win.once('ready-to-show', () => win.show());

    win.once('close', () => {
        appStore.unsubscribe(win);
        win = null;
    });

    checkInspect(win);

    return win;
};

const getOnboardingWindow = () => {
    if (win) return win;

    return generateOnboardingWindow();
};

module.exports = {
    generateOnboardingWindow,
    getOnboardingWindow
};
