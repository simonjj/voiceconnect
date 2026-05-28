const path = require('path');
const { BrowserWindow } = require('electron');

const { getInitialBounds } = require('../lib/browserWindow');
const settingsStore = require('../lib/settingsStore');
const { appStore } = require('../lib/MemoryStore');

const { registerDrag, unregisterDrag } = require('../utils/drag');
const checkInspect = require('../utils/checkInspect');

let win = null;

const WIDTH = 335;
const HEIGHT = 445;

const generateTutorialWindow = () => {
    if (win) return win;

    const initialBounds = getInitialBounds(settingsStore, HEIGHT, WIDTH);

    win = new BrowserWindow({
        ...initialBounds,
        width: WIDTH,
        height: HEIGHT,
        minWidth: WIDTH,
        minHeight: HEIGHT,
        maxWidth: WIDTH * 2,
        maxHeight: HEIGHT * 2,
        transparent: true,
        hasShadow: false,
        frame: false,
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

    win.loadFile('renderer/dist/tutorial.html');
    win.slug = 'tutorial';
    win.setMenu(null);
    win.setAlwaysOnTop(true);
    win.store = settingsStore;

    appStore.subscribe(win);

    win.once('close', () => {
        appStore.unsubscribe(win);
        unregisterDrag(['touchstart', 'touchend']);
        win = null;
    });

    win.once('ready-to-show', () => win.show());

    registerDrag(win, 'touchstart', 'touchend');

    checkInspect(win);

    return win;
};

function getTutorialWindow() {
    return win;
}

module.exports = { generateTutorialWindow, getTutorialWindow };
