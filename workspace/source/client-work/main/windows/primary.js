/* istanbul ignore file */
/* eslint-disable no-undef */
const path = require('path');
const { BrowserWindow, screen } = require('electron');
const checkInspect = require('../utils/checkInspect');

const { windowOptions, getInitialBounds } = require('../lib/browserWindow');
const {
    MAIN_WINDOW_FOCUS,
    MAIN_WINDOW_BLUR
} = require('../../shared/constants');
const { appStore } = require('../lib/MemoryStore');
const settingsStore = require('../lib/settingsStore');
const { unregisterDrag } = require('../utils/drag');
const { registerDrag } = require('../utils/drag');

let win = null;

const primaryDimension = 320;

const generatePrimaryWindow = (view = 'renderer/dist/primary.html') => {
    if (win !== null) return win;

    const initialBounds = getInitialBounds(
        settingsStore,
        primaryDimension,
        primaryDimension
    );

    let isLaunch = true;

    win = new BrowserWindow({
        ...windowOptions,
        ...initialBounds,
        width: primaryDimension,
        height: primaryDimension,
        maxWidth: primaryDimension,
        maxHeight: primaryDimension,
        acceptFirstMouse: true,
        movable: true,
        resizeable: false,
        maximizable: false,
        closeable: false,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            enableRemoteModule: false,
            preload: path.resolve(__dirname, '../../renderer/preload/base.js'),
            contextIsolation: true
        }
    });

    win.setMenu(null);
    win.loadFile(view);
    win.slug = 'primary';
    win.tag = 'primary';
    win.store = settingsStore;
    appStore.subscribe(win);

    win.on('focus', () => {
        if (process.platform === 'linux') {
            const mousePos = screen.getCursorScreenPoint();
            const winBounds = win.getBounds();
            const inBounds =
                mousePos.x > winBounds.x &&
                mousePos.x < winBounds.x + winBounds.width &&
                mousePos.y > winBounds.y &&
                mousePos.y < winBounds.y + winBounds.height;

            if (!inBounds) return;
        }

        win && win.webContents.send(MAIN_WINDOW_FOCUS);
    });

    win.on('blur', () => {
        win && win.webContents.send(MAIN_WINDOW_BLUR);
    });

    win.webContents.on('did-finish-load', () => {
        if (!isLaunch) {
            setTimeout(
                () => win.showInactive(),
                process.platform === 'linux' ? 500 : 0
            );
        }
        isLaunch = false;
    });

    // window events handlers
    win.once('ready-to-show', () => {
        setupInitialSettings(primaryDimension, primaryDimension);
    });

    win.once('close', () => {
        appStore.unsubscribe(win);
        unregisterDrag(['dragstart', 'dragend']);
        win = null;
    });

    registerDrag(win, 'dragstart', 'dragend');
    checkInspect(win);

    return win;
};

function setupInitialSettings(height, width) {
    setTimeout(
        () => {
            win.setBounds({ height, width });
            win.setAlwaysOnTop(true);
            win.showInactive();
        },
        process.platform === 'linux' ? 500 : 0
    );
}

function getPrimaryWindow() {
    return win;
}

module.exports = {
    generatePrimaryWindow,
    getPrimaryWindow,
    setupInitialSettings
};
