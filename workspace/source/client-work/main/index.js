/* eslint-disable no-undef, camelcase */
/* istanbul ignore file */
const { platform } = require('os');
const path = require('path');
const debug = require('debug')('ttc:main:index');
process.env.NODE_CONFIG_DIR = path.resolve(__dirname, './config');

const { app, session, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const { apiBaseURL, verifiedProtocol } = require('config').get('app');
const { inAppAuth } = require('config').get('app.auth');

if (platform() === 'linux') {
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch('disable-gpu');
}

let isLaunch = true;

const { appStore } = require('./lib/MemoryStore');
const powerMonitorHandlers = require('./lib/powerMonitorHandlers');
const {
    ACCEPT_KNOCK,
    APP_UPDATE_STATUS,
    NOTIFICATION_VIEWS,
    APP_ERROR_CAUGHT,
    CLOSE_NOTIFICATION_WINDOW,
    CONVERSATION_CHANGE,
    DECLINE_KNOCK,
    GET_APP_STATE,
    GET_BG_VOLUME,
    GET_ORIGIN,
    GET_SERIALIZED_SPEECH_EXAMPLES,
    HIDE_KNOCK_WINDOW,
    KNOCK_DECLINED,
    KNOCK_EXPIRED,
    KNOCK_INITIATED,
    KNOCK_RECEIVED,
    LEAVE_TEAM,
    LOG_OUT,
    MINIMIZE_UI,
    MULTI_DEVICE_SIGNAL_RECEIVED,
    OFFLINE_DETECTED,
    ONLINE_DETECTED,
    OPEN_AUTH,
    OPEN_MAIN_DEV_TOOLS,
    OPEN_NOTIFICATION_WINDOW,
    OPEN_ONBOARDING_WINDOW,
    CLOSE_ONBOARDING_WINDOW,
    PREFERRED_MEDIA_CHANGE,
    QUIT,
    RESTART,
    SAVE_RELATIVE_BOUNDS,
    SAVE_SERIALIZED_SPEECH_EXAMPLES,
    SET_APP_STATE,
    SET_BG_VOLUME,
    SET_HOT_KEY,
    SET_IGNORE_MOUSE_EVENTS,
    SET_ORIGIN,
    STOP_POWER_SAVE_BLOCKER,
    START_POWER_SAVE_BLOCKER,
    TEAM_UPDATE,
    TEAM_JOIN_SUCCESS,
    TOGGLE_TUTORIAL,
    CHANGE_TUTORIAL_STEP,
    TOGGLE_DOOR_EVENT,
    TOGGLE_MINIMIZE,
    UPDATE_TRAY_TEAM,
    UPDATE_ONBOARDING_STATE,
    UPDATE_TEAM_PROP
} = require('../shared/constants');
const {
    auth,
    knock,
    primary,
    notification,
    onboarding,
    welcome
} = require('./windows');
const createMultiDeviceWindow = require('./windows/multiDevice');
const {
    isLoggedIn,
    logoutReq,
    requestTest,
    joinTeam
} = require('./lib/requests');
const isNetworkError = require('./utils/isNetworkError');
const heartbeat = require('./utils/heartbeat');
const { setInitialOnboardingState } = require('./utils/onboardingState');
const ipcHandlers = require('./lib/ipcHandlers');
const authentication = require('./lib/auth');
const settingsStore = require('./lib/settingsStore');
const { registerHotkeys } = require('./lib/hotkeys');
const { registerHandlers } = require('./utils/registerMainHandlers');

let browserUrl = null;
let inviteTeamCode = null;

const locked =
    process.env.NODE_ENV !== 'development'
        ? app.requestSingleInstanceLock()
        : true;
if (!locked) {
    app.quit();
    return;
}

const handleCustomProtocol = require('./utils/handleCustomProtocol');
const handleBrowserURL = async (url, isLaunch = false) => {
    const ready = await handleCustomProtocol(
        url,
        isLaunch,
        (teamCode) => (inviteTeamCode = teamCode)
    );
    if (ready && (await checkDevice())) {
        createUI();
    }
};

const checkDevice = async () => {
    try {
        const res = await isLoggedIn();
        if (res.ok) {
            const { deviceConflict } = res.body;
            if (deviceConflict) {
                return await createMultiDeviceWindow();
                return false;
            }
        }
    } catch (err) {
        return false;
    }
    return true;
};

async function createUI() {
    const { tray } = require('./plugins/tray');

    await Promise.all([
        appStore.updateTeamAndUserState(isLaunch),
        appStore.updateConversations()
    ]).catch((...errs) => debug(errs));

    let team = appStore.get('team');
    const firstVisit = appStore.get('firstVisit');

    if (!team && inviteTeamCode) {
        team = await joinTeam(inviteTeamCode);
        appStore.setState({ team });
        inviteTeamCode = null;
    }

    if (team && firstVisit) setInitialOnboardingState();

    if ((!team && !inviteTeamCode) || firstVisit) {
        onboarding.generateOnboardingWindow();
        return;
    }

    registerHandlers({
        [SET_HOT_KEY]: ipcHandlers.handleSetHotKey,
        [TOGGLE_MINIMIZE]: ipcHandlers.toggleMinimizeWindow,
        [MINIMIZE_UI]: ipcHandlers.handleMinimizeUI,
        [KNOCK_INITIATED]: ipcHandlers.knockInitiated,
        [KNOCK_RECEIVED]: ipcHandlers.knockReceived,
        [DECLINE_KNOCK]: ipcHandlers.declineKnock,
        [ACCEPT_KNOCK]: ipcHandlers.acceptKnock,
        [KNOCK_DECLINED]: ipcHandlers.knockDeclined,
        [KNOCK_EXPIRED]: ipcHandlers.knockExpired,
        [HIDE_KNOCK_WINDOW]: ipcHandlers.hideKnockWindow,
        [SAVE_RELATIVE_BOUNDS]: ipcHandlers.saveRelativeBounds,
        [TOGGLE_DOOR_EVENT]: ipcHandlers.handleToggleDoor,
        [CONVERSATION_CHANGE]: ipcHandlers.updateConversationState,
        [START_POWER_SAVE_BLOCKER]: powerMonitorHandlers.startPowerSaveBlocker,
        [STOP_POWER_SAVE_BLOCKER]: powerMonitorHandlers.stopPowerSaveBlocker,
        [OPEN_MAIN_DEV_TOOLS]: ipcHandlers.openMainDevTools,
        [SAVE_SERIALIZED_SPEECH_EXAMPLES]:
            ipcHandlers.saveSerializedSpeechExamples,
        [GET_SERIALIZED_SPEECH_EXAMPLES]:
            ipcHandlers.getSerializedSpeechExamples,
        [OPEN_NOTIFICATION_WINDOW]: ipcHandlers.handleOpenNotificationWindow,
        [CLOSE_NOTIFICATION_WINDOW]: ipcHandlers.handleCloseNotificationWindow,
        [ONLINE_DETECTED]: powerMonitorHandlers.onOnlineOrResume,
        [OFFLINE_DETECTED]: powerMonitorHandlers.onOffline,
        [PREFERRED_MEDIA_CHANGE]: ipcHandlers.handlePreferredMediaChange,
        [GET_BG_VOLUME]: ipcHandlers.getBackgroundVolume,
        [SET_BG_VOLUME]: ipcHandlers.setBackgroundVolume,
        [GET_ORIGIN]: ipcHandlers.getOrigin,
        [SET_ORIGIN]: ipcHandlers.setOrigin,
        [UPDATE_TEAM_PROP]: ipcHandlers.handleUpdateTeamProp
    });

    primary.generatePrimaryWindow();
    knock.generateKnockWindow();
    powerMonitorHandlers.setupPowerMonitorListeners();

    autoUpdater.on('checking-for-update', () => {
        const isLocked = appStore.get('isLocked');
        if (!isLocked && !isLaunch) {
            notification.openNotificationWindow(
                NOTIFICATION_VIEWS.APP_UPDATE_CHECK
            );
        }
    });

    autoUpdater.on('download-progress', (payload) => {
        try {
            const notificationWindow = notification.getNotificationWindow();
            if (notificationWindow) {
                notificationWindow.send(APP_UPDATE_STATUS, payload);
            }
        } catch (err) {
            debug(err.message);
        }
    });
    autoUpdater.on('update-downloaded', () => {
        notification.openNotificationWindow(NOTIFICATION_VIEWS.APP_UPDATE);
    });
    autoUpdater.on('update-not-available', () => {
        try {
            const notificationWindow = notification.getNotificationWindow();
            if (notificationWindow) {
                notification.openNotificationWindow(
                    NOTIFICATION_VIEWS.APP_UPDATE_NOT_AVAILABLE
                );
            }
        } catch (err) {
            debug(err.message);
        }
    });

    await tray.render();

    if (process.env.NODE_ENV !== 'development') {
        autoUpdater.checkForUpdates();
    }

    isLaunch = false;
    heartbeat();
}

const initialize = async function() {
    if (inAppAuth) {
        app.on('second-instance', () => {
            const primaryWin = primary.generatePrimaryWindow();
            if (primaryWin) {
                primaryWin.focus();
            }
        });
    } else {
        app.on('second-instance', async (_event, argv) => {
            const browserUrl = argv.find((arg) =>
                arg.startsWith(verifiedProtocol)
            );
            await handleBrowserURL(browserUrl);
        });
    }

    try {
        const checkNetwork = require('./utils/checkNetwork');
        await checkNetwork(requestTest, 2000, 8);
    } catch (err) {
        // Launch the connection error view, quit for now
        app.quit(1);
    }

    registerHandlers({
        [GET_APP_STATE]: ipcHandlers.getAppState,
        [SET_APP_STATE]: ipcHandlers.setAppState,
        [APP_ERROR_CAUGHT]: ipcHandlers.handleAppError,
        [RESTART]: ipcHandlers.restart,
        [LOG_OUT]: ipcHandlers.handleLogoutAndExit,
        [OPEN_AUTH]: async () =>
            await shell.openExternal(
                authentication.getAuthenticationUrl(inviteTeamCode)
            ),
        [TEAM_JOIN_SUCCESS]: ipcHandlers.handleJoinTeam,
        [TEAM_UPDATE]: ipcHandlers.handleTeamUpdate,
        [SET_IGNORE_MOUSE_EVENTS]: ipcHandlers.onSetIgnoreMouseEvents,
        [LEAVE_TEAM]: ipcHandlers.handleLeaveTeam,
        [UPDATE_TRAY_TEAM]: ipcHandlers.handleUpdateTrayTeam,
        [MULTI_DEVICE_SIGNAL_RECEIVED]:
            ipcHandlers.handleMultiDeviceSignalReceived,
        [QUIT]: ipcHandlers.handleQuitApp,
        [TOGGLE_TUTORIAL]: ipcHandlers.toggleTutorial,
        [CHANGE_TUTORIAL_STEP]: ipcHandlers.changeTutorialStep,
        [UPDATE_ONBOARDING_STATE]: ipcHandlers.updateOnboardingState,
        [OPEN_ONBOARDING_WINDOW]: ipcHandlers.handleOpenOnboardingWindow,
        [CLOSE_ONBOARDING_WINDOW]: ipcHandlers.handleCloseOnboardingWindow
    });

    const filter = { urls: [`${apiBaseURL}/*`] };
    session.defaultSession.webRequest.onBeforeSendHeaders(
        filter,
        async (details, cb) => {
            try {
                await authentication.refreshTokens();
            } catch (err) {
                return false;
            }
            const access_token = await authentication.getAccessToken();
            details.requestHeaders['Authorization'] = `Bearer ${access_token}`;
            details.requestHeaders['X-Machine-Id'] = settingsStore.get(
                'machineID'
            );
            details.requestHeaders['X-Application-Version'] = app.getVersion();
            cb({ requestHeaders: details.requestHeaders });
        }
    );
    session.defaultSession.webRequest.onErrorOccurred(filter, (details) => {
        if (
            details.error === 'net::ERR_NETWORK_CHANGED' ||
            details.error === 'net::ERR_HTTP2_PROTOCOL_ERROR'
        ) {
            debug(details.error);
            return heartbeat.restart();
        }
        if (details.error !== 'net::ERR_ABORTED') debug(details);
    });
    await session.defaultSession.clearCache();

    if (process.platform === 'darwin') {
        const { getMediaPermissions } = require('./lib/userMedia');
        await getMediaPermissions();
    }

    try {
        await authentication.refreshTokens();
    } catch (err) {
        if (!isNetworkError(err)) {
            if (inAppAuth) {
                await auth();
            } else {
                welcome.generateWelcomeWindow();
            }
        }
    } finally {
        if (await checkDevice()) {
            createUI();
        }
    }
};

// open from browser
if (!inAppAuth) {
    if (process.platform === 'win32') {
        app.setAsDefaultProtocolClient('connect', process.execPath);
    } else {
        app.setAsDefaultProtocolClient('connect');
    }

    app.on('will-finish-launching', async () => {
        app.on('open-url', async function(_event, url) {
            browserUrl = url;
        });
    });

    if (process.platform === 'darwin') {
        app.on('open-url', async function(_event, url) {
            await handleBrowserURL(url);
        });
    }
}

app.on('ready', async () => {
    const isRelaunch = process.env.LAUNCH_TYPE === 'relaunch';

    if (!inAppAuth) {
        try {
            if (process.platform === 'darwin' && browserUrl && !isRelaunch) {
                await handleBrowserURL(browserUrl, true);
            }

            if (process.platform === 'win32' && !isRelaunch) {
                browserUrl = process.argv.find((arg) =>
                    arg.startsWith(verifiedProtocol)
                );
                if (browserUrl) {
                    await handleBrowserURL(browserUrl, true);
                }
            }
        } catch (error) {
            debug(error.message);
        }
    }

    delete process.env.LAUNCH_TYPE;

    process.platform === 'linux' ? setTimeout(initialize, 500) : initialize();
    registerHotkeys();
});

app.on('will-quit', async () => {
    logoutReq();
});

app.on('window-all-closed', function(e) {
    e.preventDefault();
});
