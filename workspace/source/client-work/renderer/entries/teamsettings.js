import React from 'react';
import { render } from 'react-dom';
import ipcRenderer from '../lib/ipcRenderer';
import loadable from '@loadable/component';
import { AppStateProvider } from '../contexts/AppStateContext';
import TeamSettings from '../components/TeamSettings';

const Theme = loadable(() =>
    import(/* webpackChunkName: "ConnectTheme" */ '../utilities/Theme')
);

const teamSettingsEl = document.getElementById('teamSettings');

render(
    <Theme>
        <AppStateProvider ipcRendererInstance={ipcRenderer}>
            <TeamSettings />
        </AppStateProvider>
    </Theme>,
    teamSettingsEl
);
