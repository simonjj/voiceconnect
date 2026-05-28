let ipcRenderer = null;

try {
    ipcRenderer = window.electron.ipcRenderer();
    ipcRenderer.on = window.electron.ipcRendererOn;
    ipcRenderer.removeListener = window.electron.ipcRendererOff;

    if (!('ipcRenderer' in window)) window.ipcRenderer = ipcRenderer;
} catch (err) {
    console.error(err);
}

export default ipcRenderer;
