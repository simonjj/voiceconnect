/* istanbul ignore file */
const { contextBridge } = require('electron');
const ipcRendererBridge = require('./ipcRendererBridge');

const config = require('config');

contextBridge.exposeInMainWorld('electron', {
    ...ipcRendererBridge,
    config: () => config.get('app.helpURL')
});
