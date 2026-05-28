import React, { useState, useEffect, useCallback } from 'react';

import { RESTART } from '../../../shared/constants';

import ipcRenderer from '../../lib/ipcRenderer';

const classes =
    'mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-button--accent';

const releaseNotesURL =
    'https://s3.amazonaws.com/connect-downloads/connect-release-notes.html';

const AppUpdate = () => {
    const [notes, setReleaseNotes] = useState(null);

    const getReleaseNotes = useCallback(async (abortController) => {
        try {
            const res = await fetch(releaseNotesURL);
            if (res.ok && !abortController.signal.aborted) {
                setReleaseNotes(await res.text());
            }
        } catch (err) {
            console.log(err);
        }
    }, []);

    useEffect(() => {
        const abortController = new AbortController();
        getReleaseNotes(abortController);

        return () => {
            abortController.abort();
        };
    }, [getReleaseNotes]);

    return (
        <React.Fragment>
            <div dangerouslySetInnerHTML={{ __html: notes }} />
            <div className="buttonBar">
                <button className={classes} onClick={() => window.close()}>
                    Update next launch
                </button>
                <button
                    className={classes}
                    onClick={() => ipcRenderer.invoke(RESTART)}
                >
                    Update and Relaunch
                </button>
            </div>
        </React.Fragment>
    );
};

export default AppUpdate;
