import React from 'react';
import { render } from 'react-dom';
import loadable from '@loadable/component';

import { AppStateProvider } from '../contexts/AppStateContext';
import { TeamServiceProvider } from '../contexts/TeamServiceContext';
import Tutorial from '../components/Tutorial';

import ipcRenderer from '../lib/ipcRenderer';

const Theme = loadable(() =>
    import(/* webpackChunkName: "ConnectTheme" */ '../utilities/Theme')
);

const tutorialEl = document.getElementById('tutorial');

render(
    <>
        <AppStateProvider ipcRendererInstance={ipcRenderer}>
            <TeamServiceProvider>
                <Theme>
                    <Tutorial />
                </Theme>
            </TeamServiceProvider>
        </AppStateProvider>
    </>,
    tutorialEl
);
