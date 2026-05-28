import React from 'react';
import loadable from '@loadable/component';

import { LEAVE_TEAM, LOG_OUT } from '../../../shared/constants';
import { useAppState } from '../../hooks/useAppState';
import ipcRenderer from '../../lib/ipcRenderer';

const Button = loadable(() =>
    import(/* webpackChunkName: "mdl-Button" */ '@material-ui/core/Button')
);

const LogOut = () => {
    const [appState] = useAppState();

    function logOutAndQuit() {
        ipcRenderer.invoke(LOG_OUT, { relaunch: false });
    }
    function logOutAndRelaunch() {
        ipcRenderer.invoke(LOG_OUT, { relaunch: true });
    }
    function leaveTeam() {
        ipcRenderer.invoke(LEAVE_TEAM, appState.team.code);
    }

    return (
        <div className="c-logout">
            <p>Goodbye for now! Would you like to:</p>
            <div className="o-flex u-gutter--bottom">
                <Button
                    className="mdl-button mdl-button--raised mdl-button--colored"
                    onClick={logOutAndRelaunch}
                >
                    Keep Connecting
                </Button>
                <Button
                    className="mdl-button mdl-button--raised mdl-button--colored"
                    onClick={logOutAndQuit}
                >
                    Disconnect
                </Button>
                <Button
                    className="mdl-button mdl-button--raised mdl-button--colored"
                    onClick={leaveTeam}
                >
                    Leave Team
                </Button>
            </div>

            <p>Oh, snap. I’m lost!</p>
            <Button
                className="mdl-button mdl-button--raised mdl-button--accent"
                onClick={() => window.close()}
            >
                Stay Logged In
            </Button>
        </div>
    );
};

export default LogOut;
