const { reqStartBroadcast } = require('../requests');
const { app, BrowserWindow } = require('electron');

const { primary, knock, teamSettings } = require('../../windows');
const { startConversation } = require('../../lib/requests');
const { appStore } = require('../MemoryStore');

async function toggleMinimizeWindowFromTray() {
    const userWindowState = appStore.get('windowMinimized');
    const { minimizedUserValue } = userWindowState;

    const win = primary.getPrimaryWindow();
    if (minimizedUserValue) {
        win.show();
    } else {
        win.hide();
    }

    appStore.setState({
        windowMinimized: {
            minimizedUserValue: !minimizedUserValue,
            minimizedSavedValue: !minimizedUserValue
        }
    });
    app.emit('rerenderTray');
}

async function handleTeammateClick(teammate) {
    await startConversation(teammate._id);
    knock.getKnockWindow().hide();
}

async function handleBroadcastFromTray() {
    await reqStartBroadcast();
}

function refreshUI() {
    const mainWin = BrowserWindow.getAllWindows().find(
        (w) => w.slug === 'primary'
    );
    mainWin.hide();
    mainWin.center();
    mainWin.webContents.reload();
}

async function handleUpdateTeamProp(_, payload) {
    appStore.setState({
        team: { ...appStore.get('team'), ...payload }
    });
    if (!appStore.checkIfUserIsAdminOrOwner()) {
        const win = teamSettings.getTeamSettingsWindow();
        if (win) win.close();
    }
    app.emit('rerenderTray');
}

async function handleUpdateTrayTeam(_, payload) {
    const formattedPayload = Object.values(payload);
    appStore.setState({
        team: { ...appStore.get('team'), members: formattedPayload }
    });
    app.emit('rerenderTray');
}

module.exports = {
    toggleMinimizeWindowFromTray,
    handleTeammateClick,
    refreshUI,
    handleUpdateTrayTeam,
    handleBroadcastFromTray,
    handleUpdateTeamProp
};
