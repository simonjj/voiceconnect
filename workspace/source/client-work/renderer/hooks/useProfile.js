/* global config */
import { useContext } from 'react';

const { apiBaseURL } = config;
import { ProfileContext } from '../contexts/ProfileContext';
import { TOGGLE_DOOR_EVENT } from '../../shared/constants';
import ipcRenderer from '../lib/ipcRenderer';

export default () => {
    const [profile, dispatch] = useContext(ProfileContext);

    const methods = {
        toggleDoor: () => {
            dispatch({
                type: 'door-state',
                payload: {
                    doorOpen: !profile.doorOpen
                }
            });
            ipcRenderer.invoke(TOGGLE_DOOR_EVENT, !profile.doorOpen);
        },
        toggleMute: async () => {
            dispatch({
                type: 'muted-state',
                payload: { muted: !profile.muted }
            });

            await fetch(
                `${apiBaseURL}/muted/${profile.muted ? 'unmute' : 'mute'}`,
                {
                    method: 'PUT'
                }
            );
        }
    };

    return [profile, methods];
};
