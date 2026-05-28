import { GET_APP_STATE, SET_APP_STATE } from '../../shared/constants';
import ipcRenderer from './ipcRenderer';

export function makeGetAppState(ipcRendererInstance = ipcRenderer) {
    return async function() {
        return await ipcRendererInstance.invoke(GET_APP_STATE);
    };
}

export function makeSetAppState(ipcRendererInstance = ipcRenderer) {
    return function(data) {
        ipcRendererInstance.invoke(SET_APP_STATE, data);
    };
}
