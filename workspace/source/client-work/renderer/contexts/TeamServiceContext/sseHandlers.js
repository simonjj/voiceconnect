const {
    KNOCK_INITIATED,
    KNOCK_RECEIVED,
    KNOCK_EXPIRED,
    KNOCK_DECLINED,
    HIDE_KNOCK_WINDOW,
    MULTI_DEVICE_SIGNAL_RECEIVED,
    INSTANCE_QUIT_SIGNAL_RECEIVED,
    INSTANCE_CHOSEN_SIGNAL_RECEIVED,
    OPEN_NOTIFICATION_WINDOW,
    NOTIFICATION_VIEWS,
    TOGGLE_MINIMIZE,
    TEAM_UPDATE
} = require('../../../shared/constants');

import ipcRenderer from '../../lib/ipcRenderer';

const onToggleMemberOnline = () => {
    ipcRenderer.invoke(TEAM_UPDATE);
};

const onUserKnockStart = ({ data }) => {
    ipcRenderer.invoke(KNOCK_INITIATED, data);
};

const onMemberKnockStart = ({ data }) => {
    ipcRenderer.invoke(KNOCK_RECEIVED, data);
};

const onKnockExpired = ({ data }) => {
    ipcRenderer.invoke(KNOCK_EXPIRED, data);
};

const onKnockDeclined = ({ data }) => {
    ipcRenderer.invoke(KNOCK_DECLINED, data);
};

const onKnockAccepted = ({ data }) => {
    ipcRenderer.invoke(HIDE_KNOCK_WINDOW, data);
};

const onMinimizeWindow = (data) => {
    ipcRenderer.invoke(TOGGLE_MINIMIZE, data);
};

const onPrivateConversationWarning = () => {
    ipcRenderer.invoke(OPEN_NOTIFICATION_WINDOW, {
        view: NOTIFICATION_VIEWS.PRIVATE_WARN
    });
};

function multiDeviceReceived() {
    ipcRenderer.invoke(MULTI_DEVICE_SIGNAL_RECEIVED);
}

function handleInstanceQuit(event) {
    const data = JSON.parse(event.data);
    ipcRenderer.invoke(INSTANCE_QUIT_SIGNAL_RECEIVED, data);
}

function handleInstanceChosen(event) {
    const data = JSON.parse(event.data);
    ipcRenderer.invoke(INSTANCE_CHOSEN_SIGNAL_RECEIVED, data);
}

export default {
    onUserKnockStart,
    onMemberKnockStart,
    onKnockExpired,
    onKnockDeclined,
    onKnockAccepted,
    onPrivateConversationWarning,
    multiDeviceReceived,
    handleInstanceQuit,
    handleInstanceChosen,
    onToggleMemberOnline,
    onMinimizeWindow
};
