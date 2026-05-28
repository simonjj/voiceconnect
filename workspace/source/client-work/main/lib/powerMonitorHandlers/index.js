const { powerMonitor, powerSaveBlocker } = require('electron');
const { closeDoor, toggleDoor } = require('../doorFunctions');
const { appStore } = require('../MemoryStore');
const { endConversation } = require('../requests');

const { primary } = require('../../windows');
const { restart } = require('../ipcHandlers');
const { NOTIFICATION_VIEWS } = require('../../../shared/constants');

let lockCheck = null;
let powerSaveBlockerId = null;

function startPowerSaveBlocker() {
    if (powerSaveBlockerId === null) {
        powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
    }
}

function stopPowerSaveBlocker() {
    if (powerSaveBlockerId !== null) {
        powerSaveBlocker.stop(powerSaveBlockerId);
        powerSaveBlockerId = null;
    }
}

function setLastDoorState() {
    appStore.setState({ lastDoorState: appStore.get('user.doorOpen') });
}

async function resetDoorStateOnResume() {
    appStore.setState({ isLocked: false });
    clearTimeout(lockCheck);
    const lastDoorState = appStore.get('lastDoorState');

    if (
        lastDoorState !== undefined &&
        lastDoorState !== appStore.get('user.doorOpen')
    ) {
        await toggleDoor();
    }
    const notification = appStore.get('notificationView');

    if (notification !== NOTIFICATION_VIEWS.APP_UPDATE) {
        const win = primary.getPrimaryWindow();
        win.reload();
    }
}

function onOffline() {
    const isLocked = appStore.get('isLocked');

    if (!isLocked) {
        setLastDoorState();
    }

    appStore.setState({ suspendedOrOffline: true });
}

async function onOnlineOrResume() {
    await resetDoorStateOnResume();
    appStore.setState({ suspendedOrOffline: false });
}

async function checkForUpdates() {
    const { autoUpdater } = require('electron-updater');

    autoUpdater.once('update-downloaded', () => {
        const isLocked = appStore.get('isLocked');
        if (isLocked === true) autoUpdater.quitAndInstall();
    });
    await autoUpdater.checkForUpdates();
}

async function onLock() {
    appStore.setState({ isLocked: true });
    const doorOpen = appStore.get('user.doorOpen');
    setLastDoorState();

    if (doorOpen) {
        await closeDoor();
    }

    await checkForUpdates();
}

function setupPowerMonitorListeners() {
    powerMonitor.addListener('suspend', onOffline);
    powerMonitor.addListener('resume', onOnlineOrResume);
    powerMonitor.addListener('lock-screen', onLock);
    powerMonitor.addListener('unlock-screen', resetDoorStateOnResume);
    powerMonitor.addListener('shutdown', endConversation);

    const state = powerMonitor.getSystemIdleState(1);
    if (state === 'locked') {
        try {
            const win = primary.getPrimaryWindow();
            win.webContents.once('did-finish-load', () => {
                lockCheck = setTimeout(onLock, 500);
            });
        } catch (err) {}
    }
}

module.exports = {
    onOffline,
    onOnlineOrResume,
    setupPowerMonitorListeners,
    startPowerSaveBlocker,
    stopPowerSaveBlocker
};
