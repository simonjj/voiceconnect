import React from 'react';
import { render } from 'react-dom';

import loadable from '@loadable/component';
const Theme = loadable(() =>
    import(/* webpackChunkName: "ConnectTheme" */ '../utilities/Theme')
);

import { AppStateProvider } from '../contexts/AppStateContext';
import Settings from '../components/Settings';

const settingsEl = document.getElementById('settings');

import ipcRenderer from '../lib/ipcRenderer';

window.helpURL = window.electron.config();

render(
    <>
        <AppStateProvider ipcRendererInstance={ipcRenderer}>
            <Theme>
                <Settings />
            </Theme>
        </AppStateProvider>
    </>,
    settingsEl
);
