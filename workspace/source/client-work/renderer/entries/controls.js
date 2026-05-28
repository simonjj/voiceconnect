/* istanbul ignore file */
import React from 'react';
import { render } from 'react-dom';

import loadable from '@loadable/component';
const Theme = loadable(() =>
    import(/* webpackChunkName: "ConnectTheme" */ '../utilities/Theme')
);

import Controls from '../components/Controls';
import { AppStateProvider } from '../contexts/AppStateContext';

const controls = document.getElementById('controls');

import ipcRenderer from '../lib/ipcRenderer';

render(
    <>
        <Theme />
        <AppStateProvider ipcRendererInstance={ipcRenderer}>
            <Controls />
        </AppStateProvider>
    </>,
    controls
);
