import React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';

import loadable from '@loadable/component';
const Theme = loadable(() =>
    import(/* webpackChunkName: "ConnectTheme" */ '../utilities/Theme')
);

import Notification from '../components/Notification';
import ipcRenderer from '../lib/ipcRenderer';
import { AppStateProvider } from '../contexts/AppStateContext';

let notificationEl = null;

function __MAIN__() {
    render(
        <Theme>
            <AppStateProvider ipcRendererInstance={ipcRenderer}>
                <Notification />
            </AppStateProvider>
        </Theme>,
        notificationEl
    );
}

window.onload = () => {
    notificationEl = document.getElementById('notification');
    __MAIN__();
};

if (module.hot) {
    module.hot.accept(() => {
        unmountComponentAtNode(notificationEl);
        __MAIN__();
    });
}
