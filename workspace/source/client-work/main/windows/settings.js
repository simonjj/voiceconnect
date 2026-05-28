const path = require('path');
const { BrowserWindow } = require('electron');
const checkInspect = require('../utils/checkInspect');

const { appStore } = require('../lib/MemoryStore');

let win = null;
const generateSettingsWindow = () => {
    if (win) return win;

    const options = {
        width: 1000,
        height: 500,
        modal: true,
        webPreferences: {
            nodeIntegration: false,
            enableRemoteModule: false,
            preload: path.resolve(
                __dirname,
                '../../renderer/preload/settings.js'
            ),
            contextIsolation: true
        }
    };

    win = new BrowserWindow(options);
    win.loadFile('renderer/dist/settings.html');
    win.slug = 'settings';
    win.setMenu(null);
    appStore.subscribe(win);

    win.once('close', () => {
        appStore.unsubscribe(win);
        win = null;
    });

    checkInspect(win);
    return win;
};

const getSettingsWindow = () => {
    return win;
};

const openSettingsView = (view) => {
    appStore.setState({ settingsView: view });
    const win = generateSettingsWindow();
    win.show();
    return win;
};

module.exports = {
    generateSettingsWindow,
    openSettingsView,
    getSettingsWindow
};
