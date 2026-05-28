const path = require('path');
const { BrowserWindow } = require('electron');
const checkInspect = require('../utils/checkInspect');

const { appStore } = require('../lib/MemoryStore');

let win = null;
const generateNotificationWindow = () => {
    if (win) return win;

    const primaryWin = BrowserWindow.getAllWindows().find(
        (w) => w.slug === 'primary'
    );

    const options = {
        alwaysOnTop: true,
        frame: false,
        width: 600,
        height: 300,
        modal: true,
        show: false,
        parent: primaryWin || null,
        webPreferences: {
            nodeIntegration: false,
            enableRemoteModule: false,
            preload: path.resolve(__dirname, '../../renderer/preload/base.js'),
            contextIsolation: true
        }
    };

    win = new BrowserWindow(options);
    win.loadFile('renderer/dist/notification.html');
    win.slug = 'notification';
    win.setMenu(null);

    appStore.subscribe(win);

    win.once('close', () => {
        appStore.unsubscribe(win);
        win = null;
    });

    win.once('ready-to-show', () => win.show());

    checkInspect(win);

    return win;
};

const openNotificationWindow = (view) => {
    appStore.setState({ notificationView: view });
    return generateNotificationWindow();
};

function getNotificationWindow() {
    return win;
}

module.exports = { openNotificationWindow, getNotificationWindow };
