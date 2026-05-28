const { ipcMain } = require('electron');

const registerHandlers = (config) => {
    for (let i in config) {
        ipcMain.handle(i, config[i]);
    }
};

module.exports = { registerHandlers };
