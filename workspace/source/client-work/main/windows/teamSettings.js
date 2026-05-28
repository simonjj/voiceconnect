const path = require('path');
const { BrowserWindow } = require('electron');
const { appStore } = require('../lib/MemoryStore');
const checkInspect = require('../utils/checkInspect');

let win = null;
const generateTeamSettingsWindow = () => {
    if (win) return win;

    const options = {
        width: 1000,
        height: 500,
        webPreferences: {
            enableRemoteModule: false,
            preload: path.resolve(__dirname, '../../renderer/preload/base.js'),
            contextIsolation: true
        }
    };

    win = new BrowserWindow(options);
    win.loadFile('renderer/dist/teamsettings.html');
    win.slug = 'teamSettings';
    win.setMenu(null);
    appStore.subscribe(win);

    win.once('close', () => {
        appStore.unsubscribe(win);
        win = null;
    });

    checkInspect(win);
    return win;
};

const getTeamSettingsWindow = () => {
    return win;
};

const openTeamSettingsView = (view) => {
    appStore.setState({ teamSettingsView: view });
    const win = generateTeamSettingsWindow();
    win.show();
    return win;
};

module.exports = {
    generateTeamSettingsWindow,
    openTeamSettingsView,
    getTeamSettingsWindow
};
