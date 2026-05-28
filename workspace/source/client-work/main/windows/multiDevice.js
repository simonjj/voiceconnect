const { ipcMain, app } = require('electron');
const {
    NOTIFICATION_VIEWS,
    INSTANCE_CHOSEN,
    INSTANCE_QUIT,
    INSTANCE_CHOSEN_SIGNAL_RECEIVED,
    INSTANCE_QUIT_SIGNAL_RECEIVED
} = require('../../shared/constants');
const request = require('../utils/request');
const { openNotificationWindow } = require('./notification');
const settingsStore = require('../lib/settingsStore');

let win;

const machineID = settingsStore.get('machineID');

const createMultiDeviceWindow = () => {
    const destroyWindow = () => {
        if (!win) return;
        win.close();
        win = null;
    };

    if (win) destroyWindow();

    return new Promise((resolve) => {
        win = openNotificationWindow(NOTIFICATION_VIEWS.MULTI_DEVICE);

        const cleanupListeners = () => {
            ipcMain.removeHandler(
                INSTANCE_CHOSEN_SIGNAL_RECEIVED,
                handleInstanceChosenSignalReceived
            );
            ipcMain.removeHandler(
                INSTANCE_QUIT_SIGNAL_RECEIVED,
                handleInstanceQuitSignalReceived
            );
        };
        const closeAndResume = () => {
            resolve(true);
            cleanupListeners();
            destroyWindow();
        };
        const quit = (relaunch = false) => {
            cleanupListeners();
            destroyWindow();
            if (relaunch) {
                process.env.LAUNCH_TYPE = 'relaunch';
                app.relaunch();
            }
            app.exit(0);
        };
        async function handleInstanceChosenSignalReceived(_, data) {
            if (data.machineID === machineID) {
                closeAndResume();
            } else quit();
        }
        async function handleInstanceQuitSignalReceived(_, data) {
            if (data.machineID !== machineID) {
                await request.post('/instance-chosen').send();
                closeAndResume();
            } else quit();
        }

        try {
            ipcMain.handle(
                INSTANCE_CHOSEN_SIGNAL_RECEIVED,
                handleInstanceChosenSignalReceived
            );
            ipcMain.handle(
                INSTANCE_QUIT_SIGNAL_RECEIVED,
                handleInstanceQuitSignalReceived
            );
        } catch (e) {
            console.log(e);
        }
    });
};

module.exports = createMultiDeviceWindow;
