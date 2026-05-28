const { app } = require('electron');
const {
    KNOCK_RECEIVED,
    KNOCK_INITIATED,
    KNOCK_DECLINED,
    KNOCK_EXPIRED
} = require('../../../shared/constants');
const { getKnockWindow } = require('../browserWindow');
const { primary } = require('../../windows');
const notifications = require('../Notifications');
const { appStore } = require('../MemoryStore');
const { reqDeclineKnock, reqAcceptKnock } = require('../requests');

async function knockReceived(_, data) {
    const payload = JSON.parse(data);
    const win = getKnockWindow();
    win.webContents.send(KNOCK_RECEIVED, payload);
    win.show();
    notifications.createKnockNotification({ name: payload.nickname });
}

function knockInitiated(_, data) {
    const payload = JSON.parse(data);
    const win = getKnockWindow();
    win.show();
    win.webContents.send(KNOCK_INITIATED, payload);
}

async function handleMinimizeUI() {
    const win = primary.getPrimaryWindow();

    win.hide();

    appStore.setState({
        windowMinimized: {
            minimizedUserValue: true,
            minimizedSavedValue: true
        }
    });

    app.emit('rerenderTray');
}

async function toggleMinimizeWindow(_, status) {
    const win = primary.getPrimaryWindow();
    const userWindowState = appStore.get('windowMinimized');
    const { minimizedUserValue, minimizedSavedValue } = userWindowState;

    if (minimizedUserValue && status) {
        appStore.setState({
            windowMinimized: {
                minimizedUserValue: !minimizedUserValue,
                minimizedSavedValue: minimizedUserValue
            }
        });
        win.show();
        app.emit('rerenderTray');
    }

    if (!minimizedUserValue && !status && minimizedSavedValue) {
        appStore.setState({
            windowMinimized: {
                minimizedUserValue: minimizedSavedValue,
                minimizedSavedValue: false
            }
        });
        win.hide();
        app.emit('rerenderTray');
    }
}

async function declineKnock() {
    hideKnockWindow();
    await reqDeclineKnock();
}

function knockDeclined(_, data) {
    const win = getKnockWindow();
    win.webContents.send(KNOCK_DECLINED, JSON.parse(data));
    setTimeout(hideKnockWindow, 8000);
}

function hideKnockWindow() {
    const win = getKnockWindow();
    win.visible = false;
    win.hide();
}

function knockExpired(_, data) {
    const payload = JSON.parse(data);
    const win = getKnockWindow();
    if (!win.visible) {
        return;
    }

    if (payload.knocker !== payload.user) {
        notifications.createMissedKnockNotification({ name: payload.nickname });
        hideKnockWindow();
    } else {
        getKnockWindow().webContents.send(KNOCK_EXPIRED, payload);
        setTimeout(hideKnockWindow, 8000);
    }
}

async function acceptKnock() {
    await reqAcceptKnock();
    hideKnockWindow();
}

module.exports = {
    knockReceived,
    knockInitiated,
    knockDeclined,
    declineKnock,
    hideKnockWindow,
    knockExpired,
    acceptKnock,
    toggleMinimizeWindow,
    handleMinimizeUI
};
