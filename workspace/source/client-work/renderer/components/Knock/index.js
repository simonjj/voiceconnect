/* istanbul ignore file */
import './style.css';
import React, { useEffect, useState } from 'react';
import loadable from '@loadable/component';

const Button = loadable(() =>
    import(/* webpackChunkName: "mdl-Button" */ '@material-ui/core/Button')
);

import ipcRenderer from '../../lib/ipcRenderer';

const {
    HIDE_KNOCK_WINDOW,
    ACCEPT_KNOCK,
    DECLINE_KNOCK,
    KNOCK_RECEIVED,
    KNOCK_EXPIRED,
    KNOCK_DECLINED,
    KNOCK_INITIATED
} = require('../../../shared/constants');

const KNOCK_STATUS = {
    INCOMING: 'incoming',
    OUTGOING: 'outgoing',
    UNAVAILABLE: 'unavailable'
};

const Knock = () => {
    const [knockStatus, setKnockStatus] = useState(null);
    const [nickname, setNickname] = useState('');

    useEffect(() => {
        function handleKnockInitiated(_, data) {
            setNickname(data.nickname);
            setKnockStatus(KNOCK_STATUS.OUTGOING);
        }
        function handleKnockReceived(_, data) {
            setNickname(data.nickname);
            setKnockStatus(KNOCK_STATUS.INCOMING);
        }
        function handleUnavailable(_, data) {
            setKnockStatus(KNOCK_STATUS.UNAVAILABLE);
        }

        ipcRenderer.on(KNOCK_INITIATED, handleKnockInitiated);
        ipcRenderer.on(KNOCK_RECEIVED, handleKnockReceived);
        ipcRenderer.on(KNOCK_EXPIRED, handleUnavailable);
        ipcRenderer.on(KNOCK_DECLINED, handleUnavailable);

        return () => {
            ipcRenderer.removeListener(KNOCK_INITIATED, handleKnockInitiated);
            ipcRenderer.removeListener(KNOCK_RECEIVED, handleKnockReceived);
            ipcRenderer.removeListener(KNOCK_EXPIRED, handleUnavailable);
            ipcRenderer.removeListener(KNOCK_DECLINED, handleUnavailable);
        };
    }, []);

    function hide() {
        ipcRenderer.invoke(HIDE_KNOCK_WINDOW);
        setKnockStatus(null);
        setNickname('');
    }

    async function handleAcceptKnock() {
        ipcRenderer.invoke(ACCEPT_KNOCK);
        hide();
    }

    async function handleDeclineKnock() {
        ipcRenderer.invoke(DECLINE_KNOCK);
        hide();
    }

    if (!knockStatus) {
        return null;
    }

    if (knockStatus === KNOCK_STATUS.INCOMING) {
        return (
            <div>
                <p>Knock Knock!</p>
                <p>{`${nickname} is at your door.`}</p>
                <p>Would you like to:</p>
                <div className="o-flex--space-between">
                    <Button
                        className="mdl-button mdl-button--raised mdl-button--colored"
                        onClick={handleAcceptKnock}
                    >
                        Answer
                    </Button>
                    <Button
                        className="mdl-button mdl-button--colored"
                        onClick={handleDeclineKnock}
                    >
                        Ignore
                    </Button>
                </div>
            </div>
        );
    }
    if (knockStatus === KNOCK_STATUS.OUTGOING) {
        return (
            <div>
                <p>Knock Knock!</p>
                <p>{`Waiting on ${nickname}'s response.`}</p>
            </div>
        );
    }
    if (knockStatus === KNOCK_STATUS.UNAVAILABLE) {
        return (
            <div>
                <p>{nickname} is not available.</p>
                <Button
                    className="mdl-button mdl-button--raised mdl-button--colored"
                    onClick={hide}
                >
                    Ok
                </Button>
            </div>
        );
    }
};

export default Knock;
