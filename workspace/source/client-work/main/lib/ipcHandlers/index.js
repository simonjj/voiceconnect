const debug = require('debug')('ttc:main:ipcHandlers');
const { app, BrowserWindow } = require('electron');
const { platform } = require('os');

const {
    getPrimaryWindow,
    generatePrimaryWindow
} = require('../../windows/primary');
const {
    generateOnboardingWindow,
    getOnboardingWindow
} = require('../../windows/onboarding');
const createMultiDeviceWindow = require('../../windows/multiDevice');
const { openNotificationWindow } = require('../../windows/notification');
const { setRelativeBounds } = require('../browserWindow');

const {
    NOTIFICATION_VIEWS,
    TF_EXAMPLES,
    ONBOARDING_STATES
} = require('../../../shared/constants');

const { appStore } = require('../MemoryStore');
const settingsStore = require('../settingsStore');
const { logoutAndExit } = require('../auth');
const { leaveTeam, endConversation } = require('../requests');
const knockHandlers = require('./knockHandlers');
const originHandlers = require('./originHandlers');
const trayHandlers = require('./trayHandlers');
const {
    generateTutorialWindow,
    getTutorialWindow
} = require('../../windows/tutorial');
const { reqFirstVisitState } = require('../requests');
const { toggleDoor } = require('../doorFunctions');
const { registerHotkeys } = require('../../lib/hotkeys');
const { setInitialOnboardingState } = require('../../utils/onboardingState');

const handleSetHotKey = (_, { key, value }) => {
    settingsStore.set('hotkeys', {
        ...settingsStore.get('hotkeys'),
        [key]: value
    });

    appStore.setState({
        hotkeys: {
            ...appStore.get('hotkeys'),
            [key]: value
        }
    });
    registerHotkeys();
};

async function handleToggleDoor(_, nextState) {
    await toggleDoor(nextState);
}

function getAppState() {
    return appStore.state;
}

async function toggleTutorial(_, data) {
    if (data) {
        const tutorial = getTutorialWindow();
        tutorial.close();
        generatePrimaryWindow();

        if (appStore.get('firstVisit')) {
            await reqFirstVisitState();
            appStore.setState({ firstVisit: false });
        }

        appStore.setState({
            tutorial: {
                passed: data,
                step: null
            }
        });
    } else {
        BrowserWindow.getAllWindows().forEach((window) => {
            window.close();
        });
        const tutorial = generateTutorialWindow();
        tutorial.show();

        appStore.setState({
            tutorial: {
                passed: data,
                step: 1
            }
        });
    }
}

async function startTutorialFromTray() {
    await toggleTutorial(null, false);
}

function changeTutorialStep(_, step) {
    appStore.setState({
        tutorial: {
            passed: false,
            step
        }
    });
}

function setAppState(_, data) {
    appStore.setState(data);
}

function handleAppError(_, errorInfo) {
    if (process.env.NODE_ENV === 'development') {
        appStore.setState({ appError: errorInfo });
    }
    openNotificationWindow(NOTIFICATION_VIEWS.APP_ERROR);
}

async function restart(_, team) {
    await endConversation(team);
    process.env.LAUNCH_TYPE = 'relaunch';
    app.relaunch();
    app.exit(0);
}

async function handleLogoutAndExit() {
    await logoutAndExit();
}

async function handleQuitApp(_, conversationStatus) {
    try {
        if (conversationStatus) await endConversation();
        app.emit('destroyTray');
    } catch (e) {
        console.log(e.message);
    } finally {
        app.exit();
    }
}

function saveRelativeBounds(_, data) {
    const setBounds = (win) => {
        debug({
            bounds: win.getBounds()
        });
        const { x, y } = win.getBounds();
        setRelativeBounds('x', x, win);
        setRelativeBounds('y', y, win);
        debug({
            rel: win.store.get('relativeBounds')
        });
    };

    if (data.type === 'main') {
        const mainWindow = getPrimaryWindow();
        setBounds(mainWindow);
    }

    if (data.type === 'tutorial') {
        const tutorial = getTutorialWindow();
        setBounds(tutorial);
    }
}

function updateConversationState(_, data) {
    const userId = appStore.get('user._id');
    const focusedConversation = appStore.get('focusedConversation');

    const userInConversation = data.conversations.find((c) =>
        c.members.includes(userId)
    );
    const focusedConversationEnded = !data.conversations.find(
        (c) => c._id === focusedConversation
    );
    const clearFocusedConversation =
        userInConversation || focusedConversationEnded;

    appStore.setState({
        conversations: data.conversations,
        ...(clearFocusedConversation && {
            focusedConversation: null
        })
    });
}

function openMainDevTools() {
    const mainWindow = getPrimaryWindow();
    if (mainWindow) {
        mainWindow.webContents.openDevTools({ mode: 'undocked' });
    }
}

function saveSerializedSpeechExamples(_, data) {
    settingsStore.set(`${TF_EXAMPLES}-speech`, data);
}

function getSerializedSpeechExamples() {
    return settingsStore.get(`${TF_EXAMPLES}-speech`);
}

async function handleJoinTeam(_, team, isCreated) {
    const firstVisit = appStore.get('firstVisit');
    appStore.setState({ team });

    if (firstVisit) {
        setInitialOnboardingState();
    } else if (isCreated) {
        appStore.setState({
            isTeamCreated: true,
            onboardingState: ONBOARDING_STATES.INVITATION
        });
    } else {
        await restart();
    }
}

function updateOnboardingState(_, onboardingState) {
    appStore.setState({ onboardingState });
}

function handleOpenNotificationWindow(_, { view }) {
    openNotificationWindow(view);
}

function handleCloseNotificationWindow() {
    const win = BrowserWindow.getAllWindows().find(
        (w) => w.slug === 'notification'
    );
    if (win) win.close();
    appStore.setState({ notificationView: null });
}

async function handleLeaveTeam() {
    await leaveTeam();
    await restart();
}

function handlePreferredMediaChange(_, prefMedia) {
    const prevPreferredMedia = appStore.get('preferredMedia');
    const updatedPreferredMedia = {
        ...prevPreferredMedia,
        ...prefMedia
    };
    appStore.setState({ preferredMedia: updatedPreferredMedia });
    settingsStore.set('preferredMedia', updatedPreferredMedia);
    if (prefMedia.input || prefMedia.output) {
        const mainWin = BrowserWindow.getAllWindows().find(
            (w) => w.slug === 'primary'
        );
        mainWin.webContents.reload();
    }
}

async function handleMultiDeviceSignalReceived() {
    await createMultiDeviceWindow(appStore.get('user'), appStore.get('team'));
}

function getBackgroundVolume() {
    return settingsStore.get('backgroundConversationVolume');
}

function setBackgroundVolume(_, { volume }) {
    settingsStore.set('backgroundConversationVolume', volume);
    appStore.setState({ backgroundConversationVolume: volume });
    getPrimaryWindow();
}

let ignoringMouse = false;
const currentPlatform = platform();
function onSetIgnoreMouseEvents(_, { ignore, options }) {
    if (currentPlatform === 'linux' || ignoringMouse === ignore) return;

    const win = getPrimaryWindow();

    if (win) {
        win.setIgnoreMouseEvents(ignore, { forward: true, ...options });
        ignoringMouse = ignore;
    }
}

function handleOpenTeamSettingsWindow() {
    generateOnboardingWindow();
}

function handleOpenOnboardingWindow() {
    if (!appStore.get('firstVisit')) {
        appStore.setState({ onboardingState: ONBOARDING_STATES.INVITATION });
    }
    generateOnboardingWindow();
}

function handleCloseOnboardingWindow(_, isTheEndOnboarding) {
    const isTheEndCreation = appStore.get('isTeamCreated');

    if (isTheEndOnboarding || isTheEndCreation) {
        if (isTheEndOnboarding) appStore.setState({ firstVisit: false });
        if (isTheEndCreation) appStore.setState({ isTeamCreated: false });

        restart();
    } else {
        const win = getOnboardingWindow();
        if (win) win.close();
    }
}

async function handleTeamUpdate() {
    await appStore.updateTeamAndUserState();
    app.emit('rerenderTray');
}

module.exports = {
    getAppState,
    setAppState,
    handleAppError,
    restart,
    handleLogoutAndExit,
    saveRelativeBounds,
    updateConversationState,
    openMainDevTools,
    saveSerializedSpeechExamples,
    getSerializedSpeechExamples,
    handleOpenNotificationWindow,
    handleCloseNotificationWindow,
    handleLeaveTeam,
    handlePreferredMediaChange,
    handleMultiDeviceSignalReceived,
    getBackgroundVolume,
    setBackgroundVolume,
    onSetIgnoreMouseEvents,
    handleSetHotKey,
    handleToggleDoor,
    handleOpenOnboardingWindow,
    handleOpenTeamSettingsWindow,
    handleCloseOnboardingWindow,
    updateOnboardingState,
    toggleTutorial,
    changeTutorialStep,
    startTutorialFromTray,
    handleQuitApp,
    handleJoinTeam,
    handleTeamUpdate,
    ...knockHandlers,
    ...originHandlers,
    ...trayHandlers
};
