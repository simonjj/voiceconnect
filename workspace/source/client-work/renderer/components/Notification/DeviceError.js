import React, { useEffect, useState, useCallback } from 'react';

import { CLOSE_NOTIFICATION_WINDOW } from '../../../shared/constants';

import ipcRenderer from '../../lib/ipcRenderer';
import './style.css';

const DeviceError = () => {
    const [deviceList, setDeviceList] = useState([]);

    function findInput(device) {
        return device.kind === 'audioinput';
    }

    function findOutput(device) {
        return device.kind === 'audiooutput';
    }

    const checkDevices = useCallback(async () => {
        const devices = await navigator.mediaDevices.enumerateDevices();

        if (devices.find(findInput) && devices.find(findOutput)) {
            ipcRenderer.invoke(CLOSE_NOTIFICATION_WINDOW);
        } else {
            setDeviceList(devices);
        }
    }, []);

    useEffect(() => {
        checkDevices();

        navigator.mediaDevices.addEventListener('devicechange', checkDevices);

        return () => {
            navigator.mediaDevices.removeEventListener(
                'devicechange',
                checkDevices
            );
        };
    }, [checkDevices]);

    const noInput = !deviceList.find((d) => d.kind === 'audioinput');
    const noOutput = !deviceList.find((d) => d.kind === 'audiooutput');
    const noAudioDevices = noInput && noOutput;

    const deviceMessage = (() => {
        if (noAudioDevices) {
            return 'audio devices';
        }
        if (noInput) {
            return 'audio inputs';
        }
        if (noOutput) {
            return 'audio outputs';
        }
    })();

    return (
        <div className="device-error">
            <h3>
                No {deviceMessage} found. Please connect a device to use
                Connect.
            </h3>
            <button
                className="mdl-button mdl-button--raised mdl-button--accent"
                onClick={checkDevices}
            >
                Check for devices
            </button>
        </div>
    );
};

export default DeviceError;
