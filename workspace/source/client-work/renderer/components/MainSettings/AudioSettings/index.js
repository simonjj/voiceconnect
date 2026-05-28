import React, { useEffect, useState, useMemo, useCallback } from 'react';
import propTypes from 'prop-types';
import loadable from '@loadable/component';
import Paper from '@material-ui/core/Paper';

import ipcRenderer from '../../../lib/ipcRenderer';
import useDebounce from '../../../hooks/useDebounce';
import {
    PREFERRED_MEDIA_CHANGE,
    SET_BG_VOLUME
} from '../../../../shared/constants';
import { useAppState } from '../../../hooks/useAppState';

const InputLabel = loadable(() =>
    import(
        /* webpackChunkName: "mdl-InputLabel" */ '@material-ui/core/InputLabel'
    )
);

const Autocomplete = loadable(() =>
    import(
        /* webpackChunkName: "mdl-Autocomplete" */ '@material-ui/lab/Autocomplete'
    )
);

const TextField = loadable(() =>
    import(
        /* webpackChunkName: "mdl-TextField" */ '@material-ui/core/TextField'
    )
);

const Slider = loadable(() =>
    import(/* webpackChunkName: "mdl-Slider" */ '@material-ui/core/Slider')
);

const Tooltip = loadable(() =>
    import(/* webpackChunkName: "mdl-Tooltip" */ '@material-ui/core/Tooltip')
);

const AudioSettings = () => {
    const [appState] = useAppState();
    const [userMedia, setUserMedia] = useState([]);
    const [volumePercentage, setVolumePercentage] = React.useState(
        appState.backgroundConversationVolume
    );
    const debouncedVolumePercentage = useDebounce(volumePercentage, 200);

    const inputList = useMemo(
        () => userMedia.filter((media) => media.kind === 'audioinput'),
        [userMedia]
    );

    const outputList = useMemo(
        () => userMedia.filter((media) => media.kind === 'audiooutput'),
        [userMedia]
    );

    const getDevices = useCallback(async () => {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setUserMedia(devices.filter((d) => d.kind.startsWith('audio')));
    }, []);

    useEffect(() => {
        getDevices();

        // this listener never fires on linux so linux users will not see updated devices if they add/remove them while the window is open.
        navigator.mediaDevices.addEventListener('devicechange', getDevices);

        return () => {
            navigator.mediaDevices.removeEventListener(
                'devicechange',
                getDevices
            );
        };
    }, [getDevices]);

    useEffect(() => {
        ipcRenderer.invoke(SET_BG_VOLUME, {
            volume: debouncedVolumePercentage
        });
    }, [debouncedVolumePercentage]);

    const setPreferredUserInput = (_, { deviceId }) => {
        ipcRenderer.invoke(PREFERRED_MEDIA_CHANGE, {
            input: deviceId
        });
    };

    const setPreferredUserOutput = (_, { deviceId }) => {
        ipcRenderer.invoke(PREFERRED_MEDIA_CHANGE, {
            output: deviceId
        });
    };

    const setBackgroundVolume = (event, newValue) => {
        setVolumePercentage(newValue);
    };

    if (!userMedia.length) return <p>No media devices found</p>;

    const getValue = (type) => {
        let deviceId = 'default';

        const selectedAvailable = !!userMedia.find(
            (d) =>
                d.kind === `audio${type}` &&
                d.deviceId === appState.preferredMedia[type]
        );
        if (selectedAvailable) deviceId = appState.preferredMedia[type];

        const list = type === 'input' ? inputList : outputList;

        return list.find((item) => item.deviceId === deviceId);
    };

    const tooltipTitle =
        'Use the slider to change the volume you’ll hear conversation between your teammates. Joining a conversation will always take it to full volume.';

    return (
        <form className="o-form">
            <fieldset>
                <span className="o-form__title">Audio</span>

                <span className="o-form__subtitle">Device Options</span>

                <div className="o-form__field">
                    <div className="o-form__field-item">
                        <InputLabel id="selectAudioInputLabel">
                            Input
                        </InputLabel>
                        <Autocomplete
                            id="selectAudioInput"
                            value={getValue('input')}
                            onChange={setPreferredUserInput}
                            options={inputList}
                            getOptionLabel={(option) => option.label}
                            disablePortal
                            blurOnSelect
                            disableClearable
                            className="o-form__select"
                            renderInput={(params) => <TextField {...params} />}
                            PaperComponent={(params) => (
                                <Paper elevation={8} {...params} />
                            )}
                            onKeyDownCapture={(event) => event.preventDefault()}
                        />
                    </div>

                    <div className="o-form__field-item">
                        <InputLabel id="selectAudioOutputLabel">
                            Output
                        </InputLabel>
                        <Autocomplete
                            id="selectAudioOutput"
                            value={getValue('output')}
                            onChange={setPreferredUserOutput}
                            options={outputList}
                            getOptionLabel={(option) => option.label}
                            disablePortal
                            blurOnSelect
                            disableClearable
                            className="o-form__select"
                            renderInput={(params) => <TextField {...params} />}
                            PaperComponent={(params) => (
                                <Paper elevation={8} {...params} />
                            )}
                            onKeyDownCapture={(event) => event.preventDefault()}
                        />
                    </div>
                </div>

                <div className="o-form__field">
                    <span className="o-form__subtitle">Background Volume</span>
                    <div className="mdl-slider__container">
                        <i className="material-icons">volume_down</i>
                        <Tooltip title={tooltipTitle}>
                            <Slider
                                className="mdl-slider is-upgraded"
                                min={0}
                                max={100}
                                onChange={setBackgroundVolume}
                                value={volumePercentage}
                            />
                        </Tooltip>
                        <i className="material-icons">volume_up</i>
                    </div>
                </div>
            </fieldset>
        </form>
    );
};

AudioSettings.propTypes = {
    className: propTypes.string
};

export default AudioSettings;
