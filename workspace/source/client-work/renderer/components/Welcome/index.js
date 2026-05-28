import React from 'react';
import ipcRenderer from '../../lib/ipcRenderer';
import { OPEN_AUTH, QUIT } from '../../../shared/constants';

import './style.scss';

const Welcome = () => {
    const openAuthPage = () => {
        ipcRenderer.invoke(OPEN_AUTH);
    };

    async function quit() {
        console.log(await ipcRenderer.invoke(QUIT, false));
    }

    return (
        <div className="welcome">
            <h5>Welcome to Connect.</h5>
            <p>Please click below to login through your browser.</p>
            <button
                className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-button--accent"
                type="button"
                onClick={openAuthPage}
            >
                Log in
            </button>
            <button
                className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-button--accent"
                type="button"
                onClick={quit}
            >
                Quit
            </button>
        </div>
    );
};

export default Welcome;
