import React, { useState, useEffect } from 'react';
import loadable from '@loadable/component';

import { APP_UPDATE_STATUS } from '../../../shared/constants';
import ipcRenderer from '../../lib/ipcRenderer';

const LinearProgress = loadable(() =>
    import(
        /* webpackChunkName: "mdl-LinearProgress" */
        '@material-ui/core/LinearProgress'
    )
);

const classes =
    'mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-button--accent';

const AppUpdateCheck = () => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const onAppUpdateState = (event, payload) => {
            if (payload.percent) setProgress(payload.percent);
        };
        ipcRenderer.on(APP_UPDATE_STATUS, onAppUpdateState);

        return () => {
            ipcRenderer.removeListener(APP_UPDATE_STATUS, onAppUpdateState);
        };
    }, []);
    return (
        <div>
            <h4>Checking for updates to Connect</h4>
            <p>We are checking for available updates</p>
            <LinearProgress
                variant={progress ? 'determinate' : 'indeterminate'}
                value={progress}
            />
            <div className="buttonBar">
                <button className={classes} onClick={() => window.close()}>
                    Dismiss
                </button>
            </div>
        </div>
    );
};

export default AppUpdateCheck;
