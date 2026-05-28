/* istanbul ignore file */
const ipcChannels = require('./ipcChannels');
const notificationViews = require('./notificationViews');
const settingsViews = require('./settingsViews');
const teamSettingsViews = require('./teamSettingsViews');
const hotkeyCommands = require('./hotkeyCommands');
const onboardingStates = require('./onboardingStates');

module.exports = {
    ...ipcChannels,
    ...notificationViews,
    ...settingsViews,
    ...teamSettingsViews,
    ...hotkeyCommands,
    ...onboardingStates
};
