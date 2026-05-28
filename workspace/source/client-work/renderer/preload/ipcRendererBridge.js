const { ipcRenderer } = require('electron');

module.exports = {
    ipcRenderer: () => ipcRenderer,
    ipcRendererOn: (channel, fn) => ipcRenderer.on(channel, fn),
    ipcRendererOff: (channel, fn) => ipcRenderer.removeListener(channel, fn)
};
