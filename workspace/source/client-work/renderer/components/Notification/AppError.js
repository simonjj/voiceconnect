import React from 'react';

import { useAppState } from '../../hooks/useAppState';
import { RESTART } from '../../../shared/constants';

import ipcRenderer from '../../lib/ipcRenderer';

const AppError = () => {
    const [{ appError }] = useAppState();

    return (
        <div>
            <h5>Something went wrong</h5>
            {!!appError && (
                <div>
                    <h6>Error: {appError.error.message}</h6>
                    <p className="stack">{appError.error.stack}</p>
                    <p className="stack">{appError.info.componentStack}</p>
                </div>
            )}
            <button
                className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-button--accent"
                onClick={() => ipcRenderer.invoke(RESTART)}
            >
                Relaunch Connect
            </button>
        </div>
    );
};

export default AppError;
