import React, { useEffect } from 'react';

const { apiBaseURL } = config;
import sseHandlers from '../../contexts/TeamServiceContext/sseHandlers';

const MultiDevice = () => {
    function handleChooseThisDevice() {
        fetch(`${apiBaseURL}/instance-chosen`, { method: 'POST' });
    }

    function handleQuit() {
        fetch(`${apiBaseURL}/instance-quit`, { method: 'POST' });
    }

    useEffect(() => {
        const es = new EventSource(`${apiBaseURL}/team-service?silent=1`);
        const eventListenerPairs = [];
        const addListener = (event, cb) => {
            es.addEventListener(event, cb);
            eventListenerPairs.push([event, cb]);
        };

        addListener('instance-quit', sseHandlers.handleInstanceQuit);
        addListener('instance-chosen', sseHandlers.handleInstanceChosen);

        window.onbeforeunload = () => {
            es.close();
        };

        return () => {
            eventListenerPairs.forEach(([event, handle]) =>
                es.removeEventListener(event, handle)
            );
        };
    }, []);

    return (
        <div>
            <h5>You currently logged in on more than one device.</h5>
            <button
                className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-button--accent"
                onClick={handleChooseThisDevice}
            >
                Use this device.
            </button>
            <button
                className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-button--accent"
                onClick={handleQuit}
            >
                Close Connect on the device.
            </button>
        </div>
    );
};

export default MultiDevice;
