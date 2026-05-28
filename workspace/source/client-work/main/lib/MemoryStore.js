const parseDotNotation = require('../utils/parseDotNotation');
const { APP_STATE_UPDATE, SETTINGS_VIEWS } = require('../../shared/constants');
const settingsStore = require('./settingsStore');
const request = require('../utils/request');
const { ONBOARDING_STATES } = require('../../shared/constants');

class MemoryStore {
    constructor(initialState = {}) {
        this.state = {
            ...initialState
        };
        this.subscribedWindows = [];
    }

    get(path) {
        return parseDotNotation(path, this.state);
    }

    setState(updates) {
        this.state = {
            ...this.state,
            ...updates
        };

        this.subscribedWindows.forEach(
            (w) =>
                !w.isDestroyed() &&
                w.webContents.send(APP_STATE_UPDATE, this.state)
        );
    }

    subscribe(...windows) {
        this.subscribedWindows = [...this.subscribedWindows, ...windows];
    }

    unsubscribe(...windows) {
        this.subscribedWindows = this.subscribedWindows.filter(
            (w) => !windows.includes(w)
        );
    }
}

const initialState = {
    windowOrigin: 'center',
    windowMinimized: {
        minimizedUserValue: false,
        minimizedSavedValue: false
    },
    audioEnabled: true,
    onboardingState: ONBOARDING_STATES.TEAM_SETTINGS,
    firstVisit: true,
    isTeamCreated: false,
    tutorial: {
        passed: false,
        step: 1
    },
    focusedConversation: null,
    mutedConversations: [],
    hasTeamService: false,
    hotkeys: settingsStore.get('hotkeys'),
    suspendedOrOffline: false,
    notificationView: null,
    preferredMedia: {
        input: settingsStore.get('preferredMedia.input'),
        output: settingsStore.get('preferredMedia.output')
    },
    settingsView: SETTINGS_VIEWS.SETTINGS_MAIN,
    volumeSettings: settingsStore.get('volumeSettings'),
    backgroundConversationVolume: settingsStore.get(
        'backgroundConversationVolume'
    ),
    machineID: settingsStore.get('machineID')
};

const volumeDefaults = {
    audioEnabled: true,
    volume: 1.0
};

const appStore = new MemoryStore(initialState);

// add app specific methods here, I would like to keep the base class simple and not tied to this app
appStore.getTeamMembers = (includeSelf = false) =>
    includeSelf
        ? appStore.get('team.members')
        : appStore
              .get('team.members')
              .filter((tm) => tm._id !== appStore.get('user._id'));

appStore.checkIfUserIsAdminOrOwner = () => {
    const userId = appStore.get('user.id');
    const { owner, admins } = appStore.get('team');

    return userId === owner || admins.includes(userId);
};

appStore.updateTeamAndUserState = async (isLaunch = false) => {
    try {
        const [{ body: user }, { body: team }] = await Promise.all([
            request.get(`/profile/${isLaunch}`),
            request.get('/team')
        ]).catch((err) => {
            throw err;
        });

        if (!user.firstVisit) {
            appStore.setState({ firstVisit: user.firstVisit });
        }

        if (!team) {
            appStore.setState({ user });
            return;
        }

        const nextVolumeSettings = team.members.reduce((acc, { _id }) => {
            const existingSettings = appStore.get(`volumeSettings.${_id}`);
            return {
                ...acc,
                [_id]: existingSettings || volumeDefaults
            };
        }, {});

        appStore.setState({ team, user, volumeSettings: nextVolumeSettings });
    } catch (err) {
        console.error('appStore.updateTeamAndUserState', { err });
        throw err;
    }
};

appStore.updateConversations = async () => {
    let res;
    try {
        res = await request.get('/conversations');
        if (res.ok) {
            const { body: conversations } = res;

            appStore.setState({
                conversations
            });
        }
    } catch (err) {
        console.error('appStore.updateConversations', { err });
        throw err;
    }
};

appStore.userById = (id) =>
    appStore.get('team.members').find((tm) => tm._id === id);

module.exports = { appStore, MemoryStore };
