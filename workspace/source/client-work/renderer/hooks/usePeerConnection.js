/* global config */
import { useEffect, useRef, useContext, useState } from 'react';

import { TeamServiceContext } from '../contexts/TeamServiceContext';
import useQueue from './useQueue';
import useInputStream from './useInputStream';

const { apiBaseURL, peerConfig } = config;

const usePeerConnection = ({ member, polite, onTrack }) => {
    const { online } = member;
    const peer = useRef(null);
    const abort = useRef(null);
    const { sse } = useContext(TeamServiceContext);
    const stream = useInputStream(member);

    const [ready, setReady] = useState(false);

    const onPeerSignal = ({ data: message }) => {
        const parsedMessage = JSON.parse(message);
        const { signal, src: caller } = parsedMessage;

        if (!peer.current) return;
        if (caller !== member._id) return;
        if (!signal) return;

        if (signal.candidate) return onInboundIceCandidate(signal);

        if (signal.type === 'offer') return onOffer(signal);
        if (signal.type === 'answer') return onAnswer(signal);
    };

    const doPost = (url, options) => {
        const method = 'POST';
        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
        return fetch(url, { method, headers, ...options });
    };

    const process = async (event, done) => {
        if (!sse) return;
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
            if (!abort.current || !abort.current.signal.aborted) done();
        }
    };
    const send = useQueue(process);

    const onIceCandidate = async (e) => {
        if (e.candidate) {
            send({ type: 'peer-signal', payload: { signal: e.candidate } });
        }
    };
    const onIceConnectionStateChange = () => {
        if (peer.current.iceConnectionState === 'failed' && member.online)
            if (!polite) {
                peer.current.restartIce();
            }
    };
    const onConnectionStateChange = () => {
        const state = peer.current.connectionState;
        if (['failed', 'closed', 'disconnected'].indexOf(state) !== -1) {
            if (peer.current.connectionState === 'failed' && member.online) {
                if (!polite) {
                    peer.current.restartIce();
                }
            }
        }
    };
    const onNegotiationNeeded = async () => {
        try {
            peer.current.offering = true;
            await peer.current.setLocalDescription(
                await peer.current.createOffer()
            );
            send({
                type: 'peer-signal',
                payload: { signal: peer.current.localDescription }
            });
        } catch (err) {
            console.error(err);
        } finally {
            peer.current.offering = false;
        }
    };

    const onInboundIceCandidate = async (candidate) => {
        try {
            await peer.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
            if (!peer.current.ignoreOffer) console.error(err);
        }
    };

    const addTrack = async () => {
        if (!peer.current) return;

        const [track] = stream.getAudioTracks();
        const [transceiver] = peer.current.getTransceivers();
        if (transceiver && transceiver.sender && transceiver.sender.track) {
            await transceiver.sender.replaceTrack(track);
            await transceiver.sender.setStreams(stream);
        } else {
            await peer.current.addTrack(track, stream);
        }
    };

    const onOffer = async (signal) => {
        try {
            const collision =
                peer.current.offering ||
                peer.current.signalingState !== 'stable';
            peer.current.ignoreOffer = !polite && collision;
            if (peer.current.ignoreOffer) return;

            await peer.current.setRemoteDescription(signal);
            await addTrack();
            await peer.current.setLocalDescription(
                await peer.current.createAnswer()
            );
            if (peer.current.localDescription) {
                send({
                    type: 'peer-signal',
                    payload: { signal: peer.current.localDescription }
                });
            }
        } catch (err) {
            console.error(err);
        }
    };
    const onAnswer = async (signal) => {
        try {
            await peer.current.setRemoteDescription(
                new RTCSessionDescription(signal)
            );
        } catch (err) {
            console.error(err);
        }
    };

    const init = () => {
        if (!sse) return;
        if (!stream) return;

        if (peer.current != null) return;

        abort.current = new AbortController();

        peer.current = new RTCPeerConnection(peerConfig);
        peer.current.offering = false;
        peer.current.ignoreOffer = false;

        peer.current.onnegotiationneeded = onNegotiationNeeded;
        peer.current.oniceconnectionstatechange = onIceConnectionStateChange;
        peer.current.onconnectionstatechange = onConnectionStateChange;
        peer.current.ontrack = onTrack;
        peer.current.onicecandidate = onIceCandidate;

        sse.addEventListener('peer-signal', onPeerSignal);

        return () => {
            if (!peer.current) return;
            abort.current && abort.current.abort();

            peer.current.onnegotiationneeded = null;
            peer.current.onicegatheringstatechange = null;
            peer.current.oniceconnectionstatechange = null;
            peer.current.onconnectionstatechange = null;
            peer.current.ontrack = null;
            peer.current.onicecandidate = null;

            peer.current.close();
            peer.current = null;

            sse.removeEventListener('peer-signal', onPeerSignal);
        };
    };
    useEffect(init, [sse, stream, online]); //eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        send({ type: 'peer-ready-state', payload: { ready } });
    }, [ready]); //eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (ready && !polite) {
            const abortController = new AbortController();
            setTimeout(() => {
                if (!abortController.signal.aborted) addTrack();
            }, 950);
            return () => {
                abortController.abort();
            };
        }
    }, [ready, polite]); //eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (stream && stream.getAudioTracks) setReady(true);
    }, [stream]); //eslint-disable-line react-hooks/exhaustive-deps

    return peer.current;
};

export default usePeerConnection;

if (module.hot) module.hot.accept(() => module.hot.invalidate());
