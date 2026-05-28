/* global config */
import { useState, useEffect, useCallback, useContext } from 'react';

import { TeamServiceContext } from '../contexts/TeamServiceContext';
import useQueue from './useQueue';
import useInputStream from './useInputStream';

const { apiBaseURL, peerConfig } = config;

function doPost(url, options = {}) {
    const method = 'POST';
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    };
    return fetch(url, { method, headers, ...options });
}

const useRTC = ({ member, onTrack }) => {
    const [peer, setPeer] = useState(null);
    const stream = useInputStream(member);
    const { sse } = useContext(TeamServiceContext);

    const process = useCallback(
        async (event, done) => {
            const { type, payload } = event;
            const url = `${apiBaseURL}/team-service/broadcast/${type}`;

            const body = JSON.stringify({
                user: member._id,
                ...payload
            });

            try {
                if (payload.signal && payload.signal.candidate) {
                    doPost(url, { body });
                } else await doPost(url, { body });
            } finally {
                done();
            }
        },
        [sse, stream, peer] // eslint-disable-line react-hooks/exhaustive-deps
    );

    const send = useQueue(process);

    useEffect(() => {
        if (!stream || !sse) return;
        setPeer(new RTCPeerConnection(peerConfig));
    }, [sse, stream]);

    const onIceCandidate = ({ candidate }) => {
        if (candidate)
            send({
                type: 'peer-signal',
                payload: { signal: candidate }
            });
    };
    const addTrack = useCallback(async () => {
        return new Promise((res, rej) => {
            (async () => {
                const [track] = stream.getAudioTracks();
                const [transceiver] = peer.getTransceivers();

                try {
                    if (
                        transceiver &&
                        transceiver.sender &&
                        transceiver.sender.track
                    ) {
                        await transceiver.sender.replaceTrack(track);
                        await transceiver.sender.setStreams(stream);
                    } else {
                        peer.addTrack(track, stream);
                    }
                } catch (err) {
                    rej(err);
                }
                res();
            })();
        });
    }, [peer, stream]);
    const onOffer = useCallback(
        async (signal) => {
            try {
                await peer.setRemoteDescription(signal);
                await addTrack();
                await peer.setLocalDescription(await peer.createAnswer());
                send({
                    type: 'peer-signal',
                    payload: { signal: peer.localDescription }
                });
            } catch (err) {
                console.error(err);
            }
        },
        [addTrack, peer, send]
    );
    const onAnswer = useCallback(
        async (signal) => {
            try {
                await peer.setRemoteDescription(signal);
            } catch (err) {
                console.error(err);
            }
        },
        [peer]
    );
    const onInboundIceCandidate = useCallback(
        async (candidate) => {
            try {
                await peer.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
                console.error(err);
            }
        },
        [peer]
    );
    const onPeerReadyState = () => {};
    const onPeerSignal = ({ data: message }) => {
        message = JSON.parse(message);
        const { signal, src: caller } = message;

        if (caller !== member._id) return;
        if (!signal) return;

        if (signal.candidate) return onInboundIceCandidate(signal);

        if (signal.type === 'offer') return onOffer(signal);
        if (signal.type === 'answer') return onAnswer(signal);
    };
    const onConnectionStateChange = () => {};
    const onNegotiationNeeded = useCallback(async () => {
        try {
            await peer.setLocalDescription(await peer.createOffer());
            send({
                type: 'peer-signal',
                payload: { signal: peer.localDescription }
            });
        } catch (err) {
            console.error(err);
        }
    }, [peer, send]);

    useEffect(() => {
        if (!peer) return;

        const abortController = new AbortController();

        peer.onconnectionstatechange = onConnectionStateChange;
        peer.onnegotiationneeded = onNegotiationNeeded;
        peer.onicecandidate = onIceCandidate;
        peer.ontrack = onTrack;

        sse.addEventListener('peer-ready-state', onPeerReadyState);
        sse.addEventListener('peer-signal', onPeerSignal);

        if (!member.polite)
            setTimeout(addTrack, Math.random() * (150 - 160) + 150);

        return () => {
            abortController.abort();

            sse.removeEventListener('peer-signal', onPeerSignal);
            sse.removeEventListener('peer-ready-state', onPeerReadyState);

            peer.ontrack = null;
            peer.onicecandidate = null;
            peer.onnegotiationneeded = null;
            peer.onconnectionstatechange = null;

            peer.close();
        };
    }, [peer]); // eslint-disable-line react-hooks/exhaustive-deps

    return peer;
};

export default useRTC;
