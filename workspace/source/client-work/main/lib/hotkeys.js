const { globalShortcut } = require('electron');

const { HOTKEY_CMDS } = require('../../shared/constants');
const settingsStore = require('./settingsStore');
const { endConversation, startConversation } = require('./requests');
const { closeDoor, openDoor } = require('./doorFunctions');

const capitalize = (str) => {
    if (typeof str !== 'string') {
        return String(str);
    }
    const [first, ...rest] = str;

    return `${first.toUpperCase()}${rest.join('')}`;
};

const hotkeysjsToElectronAcc = (combo) => {
    const split = combo.split('+');
    const convertedArr = split.map((key) => {
        if (key === 'cmd') return 'CommandOrControl';
        if (key === 'pageup') return 'PageUp';
        if (key === 'pagedown') return 'PageDown';
        return capitalize(key);
    });
    return convertedArr.join('+');
};

const hkCallbackMap = {
    [HOTKEY_CMDS.OPEN_DOOR]: openDoor,
    [HOTKEY_CMDS.CLOSE_DOOR]: closeDoor,
    [HOTKEY_CMDS.END]: endConversation
};

const getConversationCb = (hkKey) => {
    const [, targetUserId] = hkKey.split(`${HOTKEY_CMDS.CONNECT}-`);
    return startConversation.bind(null, targetUserId);
};

const registerHotkeys = () => {
    globalShortcut.unregisterAll();

    const hotkeys = settingsStore.get('hotkeys');
    Object.entries(hotkeys).forEach(([hkKey, combo]) => {
        const accelerator = hotkeysjsToElectronAcc(combo);
        if (hkCallbackMap[hkKey]) {
            globalShortcut.register(accelerator, () => hkCallbackMap[hkKey]());
        }
        if (hkKey.startsWith(HOTKEY_CMDS.CONNECT)) {
            const cb = getConversationCb(hkKey);
            globalShortcut.register(accelerator, cb);
        }
    });
};

module.exports = { registerHotkeys };
