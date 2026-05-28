import { HEARTBEAT_FAILURE, HEARTBEAT_SUCCESS } from '../../shared/constants';
import ipcRenderer from './ipcRenderer';
async function onOnline() {
    clearTimeout(this.timer);
    if (!this.onLine) {
        this.onLine = window.navigator.onLine;
        this.dispatchEvent(new Event('online'));
    }
}
function onOffline(skip = 8000) {
    if (!this.onLine) return;
    this.timer = setTimeout(() => {
        this.onLine = false;
        this.dispatchEvent(new Event('offline'));
    }, skip);
}

const online = new EventTarget();
online.timer = null;
online.onLine = window.navigator.onLine;

online.onOnline = onOnline.bind(online);
online.onOffline = onOffline.bind(online);

const onHeartbeatFailure = onOffline.bind(online, 0);
const onHeartbeatSuccess = onOnline.bind(online);
ipcRenderer.on(HEARTBEAT_FAILURE, onHeartbeatFailure);
ipcRenderer.on(HEARTBEAT_SUCCESS, onHeartbeatSuccess);

window.addEventListener('beforeunload', () => {
    ipcRenderer.removeListener(HEARTBEAT_FAILURE, onHeartbeatFailure);
    ipcRenderer.removeListener(HEARTBEAT_SUCCESS, onHeartbeatSuccess);
});

export default online;
