import {
    OPEN_NOTIFICATION_WINDOW,
    NOTIFICATION_VIEWS
} from '../../shared/constants';

import ipcRenderer from './ipcRenderer';

async function checkDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    if (
        !devices.find((d) => d.kind === 'audioinput') ||
        !devices.find((d) => d.kind === 'audiooutput')
    ) {
        ipcRenderer.invoke(OPEN_NOTIFICATION_WINDOW, {
            view: NOTIFICATION_VIEWS.DEVICE_ERROR
        });
    }
}

export { checkDevices };
