/* istanbul ignore file */
import './Controls.css';
import React from 'react';

import loadable from '@loadable/component';
import ipcRenderer from '../../lib/ipcRenderer';
const Button = loadable(() =>
    import(/* webpackChunkName: "mdl-Button" */ '@material-ui/core/Button')
);

import { useAppState } from '../../hooks/useAppState';

import ConversationControls from './ConversationControls';
import TeamDetails from './TeamDetails';
import ConversationDetails from './ConversationDetails';

const {
    OPEN_MAIN_DEV_TOOLS,
    TOGGLE_DOOR_EVENT,
    LOG_OUT
} = require('../../../shared/constants');

const Controls = () => {
    const [appState, setAppState] = useAppState();

    const handleToggleDoor = () => {
        ipcRenderer.invoke(TOGGLE_DOOR_EVENT);
    };

    const handleToggleMute = () => {
        setAppState({ audioEnabled: !appState.audioEnabled });
    };

    const handleOpenDevTools = () => {
        ipcRenderer.invoke(OPEN_MAIN_DEV_TOOLS);
    };

    const handleLogout = () => {
        ipcRenderer.invoke(LOG_OUT, { relaunch: true });
    };

    return (
        <div className="draggable">
            <div className="o-flex u-gutter--bottom">
                <Button
                    onClick={handleOpenDevTools}
                    className="mdl-button mdl-button--raised mdl-button--colored"
                >
                    Open Main Dev Tools
                </Button>
                <Button
                    onClick={handleToggleDoor}
                    className="mdl-button mdl-button--raised mdl-button--colored"
                >
                    Toggle Door
                </Button>
                <Button
                    onClick={handleToggleMute}
                    className="mdl-button mdl-button--raised mdl-button--colored"
                >
                    Toggle Mute
                </Button>
                <Button
                    onClick={handleLogout}
                    className="mdl-button mdl-button--raised mdl-button--colored"
                >
                    Log out
                </Button>
            </div>

            <div className="o-form">
                <ConversationControls />
                <TeamDetails />
                <ConversationDetails />
            </div>
        </div>
    );
};

export default Controls;
