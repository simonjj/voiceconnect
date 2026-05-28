/* istanbul ignore file */
/* global NODE_ENV */
import loadable from '@loadable/component';

import ipcRenderer from '../lib/ipcRenderer';

import '../components/style.css';

import React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';

import online from '../lib/online';
import { checkDevices } from '../lib/checkDevices';

const Connect = loadable(() =>
    import(/* webpackChunkName: "Connect" */ '../components/Connect')
);
const ConnectOffline = loadable(() =>
    import(/* webpackChunkName: "Offline" */ '../components/Connect/Offline')
);
import { AppStateProvider } from '../contexts/AppStateContext';
import { TeamServiceProvider } from '../contexts/TeamServiceContext';
import ErrorBoundary from '../components/ErrorBoundary';

const { SET_IGNORE_MOUSE_EVENTS } = require('../../shared/constants');

let root = null;
checkDevices();

async function __MAIN__() {
    render(
        <ErrorBoundary>
            <AppStateProvider ipcRendererInstance={ipcRenderer}>
                <TeamServiceProvider>
                    <Connect />
                </TeamServiceProvider>
            </AppStateProvider>
        </ErrorBoundary>,
        root
    );
}

let ignoring = true;
document.addEventListener('pointerover', (event) => {
    if (
        (ignoring =
            event.target !== document.body &&
            event.target.offsetParent !== document.body)
    ) {
        ipcRenderer.invoke(SET_IGNORE_MOUSE_EVENTS, { ignore: false });
        ignoring = false;
    }
});
window.addEventListener('blur', () => {
    if (!ignoring) {
        ipcRenderer.invoke(SET_IGNORE_MOUSE_EVENTS, { ignore: true });
        ignoring = true;
    }
});

window.onload = () => {
    root = document.querySelector('#main');
    if (!root) throw new Error('Main element missing');

    if (online.onLine) __MAIN__();
    else render(<ConnectOffline />, root);

    if (NODE_ENV !== 'development') {
        for (let script of document.scripts) {
            script.parentElement.removeChild(script);
        }
    }
};

if (module.hot) {
    module.hot.accept(() => {
        unmountComponentAtNode(root);
        __MAIN__();
    });
}
