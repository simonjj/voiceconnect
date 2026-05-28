const auth = require('./auth');
const welcome = require('./welcome');
const controls = require('./controls');
const knock = require('./knock');
const notification = require('./notification');
const primary = require('./primary');
const settings = require('./settings');
const tutorial = require('./tutorial');
const onboarding = require('./onboarding');
const teamSettings = require('./teamSettings');

const isMac = process.platform === 'darwin';
if (isMac) {
    const { app, Menu } = require('electron');
    const template = [
        {
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideothers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        {
            label: 'File',
            submenu: [{ role: 'close' }]
        },
        {
            label: 'View',
            submenu: [{ role: 'reload' }, { role: 'forceReload' }]
        },
        {
            label: 'Edit',
            submenu: [
                {
                    label: 'Undo',
                    accelerator: 'CmdOrCtrl+Z',
                    selector: 'undo:'
                },
                {
                    label: 'Redo',
                    accelerator: 'Shift+CmdOrCtrl+Z',
                    selector: 'redo:'
                },
                { type: 'separator' },
                {
                    label: 'Cut',
                    accelerator: 'CmdOrCtrl+X',
                    selector: 'cut:'
                },
                {
                    label: 'Copy',
                    accelerator: 'CmdOrCtrl+C',
                    selector: 'copy:'
                },
                {
                    label: 'Paste',
                    accelerator: 'CmdOrCtrl+V',
                    selector: 'paste:'
                },
                {
                    label: 'Select All',
                    accelerator: 'CmdOrCtrl+A',
                    selector: 'selectAll:'
                }
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { type: 'separator' },
                { role: 'front' },
                { role: 'window' }
            ]
        }
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

module.exports = {
    auth,
    controls,
    knock,
    notification,
    primary,
    settings,
    tutorial,
    onboarding,
    welcome,
    teamSettings
};
