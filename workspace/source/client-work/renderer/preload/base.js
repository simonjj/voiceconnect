/* istanbul ignore file */
const { contextBridge } = require('electron');
const ipcRendererBridge = require('./ipcRendererBridge');

contextBridge.exposeInMainWorld('electron', {
    ...ipcRendererBridge
});
