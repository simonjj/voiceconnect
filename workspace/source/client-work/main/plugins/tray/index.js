const path = require('path');
const ipcHandlers = require('../../lib/ipcHandlers');

const { app, Tray, Menu } = require('electron');
const { controls, settings } = require('../../windows');
const { appStore } = require('../../lib/MemoryStore');
const {
    SETTINGS_VIEWS,
    TEAM_SETTINGS_VIEWS
} = require('../../../shared/constants');
const teamSettings = require('../../windows/teamSettings');

const icon = process.platform !== 'darwin' ? 'icon.png' : 'icon-mac.png';

async function checkForUpdates() {
    const { autoUpdater } = require('electron-updater');

    await autoUpdater.checkForUpdates();
}

class ConnectTray {
    constructor() {
        this.tray = null;
        this.doorOpen = appStore.get('user.doorOpen');
        this.minimized = appStore.get('windowMinimized.minimizedUserValue');

        app.on('rerenderTray', this.render.bind(this));
        app.on('destroyTray', this.destroy.bind(this));
    }

    settingsMenu = () => [
        {
            label: `${this.doorOpen ? 'Close' : 'Open'} Door`,
            click: ipcHandlers.handleToggleDoor
        },
        {
            label: `${this.minimized ? 'Maximize' : 'Minimize'} UI`,
            click: ipcHandlers.toggleMinimizeWindowFromTray
        },
        {
            type: 'separator'
        },
        {
            label: 'Profile',
            click: settings.openSettingsView.bind(null, SETTINGS_VIEWS.PROFILE)
        },
        {
            label: 'Settings',
            click: settings.openSettingsView.bind(
                null,
                SETTINGS_VIEWS.SETTINGS_MAIN
            )
        },
        {
            label: 'Refresh',
            click: ipcHandlers.refreshUI
        }
    ];

    helpMenu = () => [
        {
            label: 'Connect Help',
            click: settings.openSettingsView.bind(null, SETTINGS_VIEWS.HELP)
        },
        {
            label: 'Tutorial',
            click: ipcHandlers.startTutorialFromTray
        },
        {
            label: 'Check for updates',
            click: checkForUpdates
        }
    ];

    quitMenu = () => [
        {
            label: 'Quit',
            click: ipcHandlers.handleQuitApp
        },
        {
            label: 'Log Out',
            click: ipcHandlers.handleLogoutAndExit
        },
        {
            label: 'Leave Team',
            click: ipcHandlers.handleLeaveTeam
        }
    ];

    teamMenu = (team) => [
        {
            label: appStore.get('team.name') || appStore.get('team.code')
        },
        {
            type: 'separator'
        },
        ...team,
        {
            type: 'separator'
        },
        {
            label: 'Team Settings',
            visible: appStore.checkIfUserIsAdminOrOwner(),
            click: teamSettings.openTeamSettingsView.bind(
                null,
                TEAM_SETTINGS_VIEWS.SETTINGS_MAIN
            )
        },
        {
            label: 'Announce',
            click: ipcHandlers.handleBroadcastFromTray
        },
        {
            label: 'Invite to Team',
            visible:
                !this.isTeamPrivate || appStore.checkIfUserIsAdminOrOwner(),
            click: ipcHandlers.handleOpenOnboardingWindow
        }
    ];

    menuTemplate(team) {
        let userEmail = appStore.get('user.email');
        let menu =
            userEmail.endsWith('touchto.io') ||
            userEmail.endsWith('getteamconnect.app')
                ? [
                      {
                          label: 'Debug',
                          click() {
                              const win = controls.generateControlsWindow();
                              win.show();
                          }
                      },
                      { type: 'separator' }
                  ]
                : [];

        menu = [
            ...menu,
            {
                label: 'Team',
                submenu: this.teamMenu(team)
            },
            {
                type: 'separator'
            },
            {
                label: 'Options',
                submenu: this.settingsMenu()
            },
            {
                label: 'Help',
                submenu: this.helpMenu()
            },
            {
                label: 'Quit',
                submenu: this.quitMenu()
            }
        ];

        return Menu.buildFromTemplate(menu);
    }

    formatTeam(team) {
        team.sort((a, b) => b.online - a.online);

        return team.map((u) => {
            return {
                label: u.nickname || u.email,
                enabled: u.online,
                click: ipcHandlers.handleTeammateClick.bind(this, u)
            };
        });
    }

    async render() {
        this.doorOpen = appStore.get('user.doorOpen');
        this.isTeamPrivate = appStore.get('team.isPrivate');
        this.minimized = appStore.get('windowMinimized.minimizedUserValue');

        const teamMembers = appStore.getTeamMembers();

        if (!this.tray) {
            this.tray = new Tray(path.resolve(__dirname, 'assets', icon));
        }
        this.tray.setContextMenu(
            this.menuTemplate(this.formatTeam(teamMembers))
        );
    }

    async destroy() {
        await this.tray.destroy();
    }
}

const tray = new ConnectTray();

module.exports = { ConnectTray, tray };
