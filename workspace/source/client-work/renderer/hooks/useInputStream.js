import { useCallback, useEffect, useState } from 'react';

import useProfile from '../hooks/useProfile';
import useConversations from '../hooks/useConversations';
import { useAppState } from './useAppState';
import ipcRenderer from '../lib/ipcRenderer';
import { PREFERRED_MEDIA_CHANGE } from '../../shared/constants';

export default function(member) {
    const [appState] = useAppState();
    const [stream, setStream] = useState(null);
    const [user] = useProfile();
    const { conversations, isParticipating: uc } = useConversations(user);
    const { doorOpen } = member;
    const { muted } = user;

    const shouldSendAudio = () => {
        if (muted) return false; // if we are muted... no track

        const mc = conversations.find(
            (c) => c.members.indexOf(member._id) !== -1
        );

        if (!uc) return false; // if we are not in conversation. no
        if (uc === mc) return true; // if we are both in same. yes
        if (uc && !mc && uc.private) return false; // if in private conv, !member. no
        if (uc && !mc && doorOpen) return true; // if in conv, member,doorOpen. yes
        if (uc && !mc && !doorOpen) return false; // if in conv, !member,!doorOpen. no
        return false; // assume no
    };

    const sendAudio = () => {
        if (!stream) return;
        for (const track of stream.getAudioTracks()) {
            track.enabled = shouldSendAudio();
        }
    };

    const addAudioTrack = useCallback(async (abortController) => {
        try {
            const preferredInput = appState.preferredMedia.input;
            const input = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio:
                    preferredInput && preferredInput !== 'default'
                        ? { deviceId: preferredInput }
                        : true
            });
            for (const track of input.getAudioTracks()) {
                track.enabled = false;
            }
            if (!abortController.signal.aborted) {
                setStream(input);
            }
        } catch (err) {
            console.error(err);
        }
    }, []);

    const refresh = () => {
        ipcRenderer.invoke(PREFERRED_MEDIA_CHANGE, {
            input: 'default'
        });
    };

    useEffect(() => {
        navigator.mediaDevices.addEventListener('devicechange', refresh);
        return () =>
            navigator.mediaDevices.removeEventListener('devicechange', refresh);
    }, []);

    useEffect(() => {
        setTimeout(sendAudio, 80);
    }, [conversations, doorOpen, muted]);

    useEffect(() => {
        const abortController = new AbortController();

        if (!appState.suspendedOrOffline) {
            addAudioTrack(abortController);
        }

        return () => {
            abortController.abort();
        };
    }, [addAudioTrack, appState.suspendedOrOffline]);

    return stream;
}
