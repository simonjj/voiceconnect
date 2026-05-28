/* istanbul ignore file */
import React from 'react';
import { render } from 'react-dom';
import loadable from '@loadable/component';
import ipcRenderer from '../lib/ipcRenderer';
import Onboarding from '../components/Onboarding';
import { AppStateProvider } from '../contexts/AppStateContext';

const Theme = loadable(() =>
    import(/* webpackChunkName: "ConnectTheme" */ '../utilities/Theme')
);

const onboarding = (document && document.querySelector('#onboarding')) || null;

render(
    <>
        <AppStateProvider ipcRendererInstance={ipcRenderer}>
            <Theme>
                <Onboarding />
            </Theme>
        </AppStateProvider>
    </>,
    onboarding
);
