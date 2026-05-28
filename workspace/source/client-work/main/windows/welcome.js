/* eslint-disable camelcase */
/* istanbul ignore file */
const path = require('path');
const config = require('config');

const { verifiedProtocol } = config.app;
const { clipboard, BrowserWindow } = require('electron');
const handleCustomProtocol = require('../utils/handleCustomProtocol');

let win = null;

const generateWelcomeWindow = () => {
    if (win !== null) return win;

    win = new BrowserWindow({
        width: 500,
        height: 250,
        frame: false,
        center: true,
        webPreferences: {
            preload: path.resolve(__dirname, '../../renderer/preload/base.js'),
            contextIsolation: true
        }
    });

    win.slug = 'welcome';
    win.loadFile('renderer/dist/welcome.html');

    win.once('close', () => {
        win = null;
    });

    win.on('focus', async () => {
        const sniffclip = clipboard.readText();
        if (sniffclip.startsWith(verifiedProtocol)) {
            await handleCustomProtocol(sniffclip);
            clipboard.clear();
        }
    });

    return win;
};

function getWelcomeWindow() {
    return win;
}

module.exports = { generateWelcomeWindow, getWelcomeWindow };
