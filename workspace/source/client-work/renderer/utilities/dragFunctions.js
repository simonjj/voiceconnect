import ipcRenderer from '../lib/ipcRenderer';

export const handlePointerDown = (e, events) => {
    const isDragDisabledOnElement =
        e.target.dataset.drag === 'disabled' ||
        !!e.target.closest('[data-drag="disabled"]');

    if (!isDragDisabledOnElement) {
        events.forEach((event) =>
            ipcRenderer.invoke(event, {
                clientX: e.clientX,
                clientY: e.clientY
            })
        );
    }
};

export const handlePointerUp = (events) => {
    events.forEach((event) => ipcRenderer.invoke(event));
};
