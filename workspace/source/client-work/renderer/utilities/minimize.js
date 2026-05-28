import ipcRenderer from '../lib/ipcRenderer';
import { MINIMIZE_UI } from '../../shared/constants';

export const handleMinimizeUI = (e) => {
    // ui should minimize on double click on the same elements which provide drag
    const isDragDisabledOnElement =
        e.target.dataset.drag === 'disabled' ||
        !!e.target.closest('[data-drag="disabled"]');

    if (!isDragDisabledOnElement) {
        ipcRenderer.invoke(MINIMIZE_UI);
    }
};
