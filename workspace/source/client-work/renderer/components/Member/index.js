import React, {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import PropTypes from 'prop-types';

import clx from 'clsx';

import useConversations from '../../hooks/useConversations';
import usePeerConnection from '../../hooks/useRTC';
import { useAppState } from '../../hooks/useAppState';
import useProfile from '../../hooks/useProfile';

import {
    getBoxShadow,
    setBackgroundColor
} from '../../../main/utils/participatingColors';
import { BG_CONVERSATION_MAX } from '../../../shared/constants';
import { ParticipatingModal } from './ParticipatingModal';

import './style.scss';

const MemberDoor = ({ doorOpen, title }) => {
    return (
        <i className="Member__icons material-icons" title={title}>
            {doorOpen ? 'meeting_room' : 'sensor_door'}
        </i>
    );
};

MemberDoor.propTypes = {
    doorOpen: PropTypes.bool,
    title: PropTypes.string
};

const Badge = ({ icon }) => {
    return (
        <span className="Member__badge">
            <i className="material-icons">{icon}</i>
        </span>
    );
};

Badge.propTypes = {
    icon: PropTypes.string
};

const Member = ({
    lastLogin,
    index,
    className = '',
    switchingPages = false,
    member
}) => {
    const [user] = useProfile();
    const audioRef = useRef(null);
    const memberRef = useRef(null);
    const amplitudeRef = useRef(null);
    const calcRef = useRef(null);

    const [welcome, setWelcome] = useState(false);
    const [ready, setConversationReady] = useState(false);
    const [amplitude, setAmplitude] = useState(0);
    const [appState] = useAppState();

    const {
        startConversation,
        isParticipating,
        conversations
    } = useConversations(member);

    const isMemberBroadcasting = conversations.find(
        (conversation) =>
            conversation.members.includes(member.id) && conversation.isBroadcast
    );

    const peer = usePeerConnection({
        member,
        setConversationReady,
        onTrack: ({ track, streams: [stream] }) => {
            track.onunmute = () => {
                audioRef.current.srcObject = stream;
                setConversationReady(true);
            };
            stream.onremovetrack = () => {
                audioRef.current.srcObject = null;
                setConversationReady(false);
            };
        }
    });

    const calcAmplitude = () => {
        if (!amplitudeRef.current) return;
        const { analyser } = amplitudeRef.current;

        const bufferLength = analyser.frequencyBinCount;
        let dataArray = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(dataArray);
        const loudest = Math.max(...dataArray);
        const normalizedLoudest = (loudest - 128) / 128;

        setAmplitude(Math.max(0, normalizedLoudest));

        calcRef.current = requestAnimationFrame(calcAmplitude);
    };

    useEffect(() => {
        isParticipating && setBackgroundColor(isParticipating, memberRef);
        if (!isParticipating || !audioRef.current.srcObject) return;
        if (!amplitudeRef.current) {
            const ctx = new AudioContext();
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 2048;
            const src = ctx.createMediaStreamSource(audioRef.current.srcObject);
            src.connect(analyser);

            amplitudeRef.current = {
                ctx,
                analyser,
                src
            };
            calcRef.current = requestAnimationFrame(calcAmplitude);
        }

        return () => {
            cancelAnimationFrame(calcRef.current);
            calcRef.current = null;
            amplitudeRef.current = null;
            setAmplitude(0);
        };
    }, [isParticipating, ready]);

    useLayoutEffect(() => {
        let bounce = null;
        const abortController = new AbortController();
        bounce = setTimeout(() => {
            bounce = setTimeout(
                () => !abortController.signal.aborted && setWelcome(false),
                1500
            );
            if (!abortController.signal.aborted) setWelcome(true);
        }, 50);

        return () => {
            clearTimeout(bounce);
            abortController.abort();
        };
    }, []);

    useEffect(handleVolume, [
        conversations,
        isParticipating,
        appState.mutedConversations,
        appState.focusedConversation,
        appState.volumeSettings,
        appState.backgroundConversationVolume,
        appState.user._id,
        member._id
    ]);

    useEffect(() => {
        if (!audioRef.current) {
            return;
        }

        audioRef.current.setSinkId(appState.preferredMedia.output);
    }, [appState.preferredMedia.output]);

    function handleVolume() {
        if (!audioRef || !isParticipating || !audioRef.current) {
            return;
        }
        const mc = isParticipating;

        const memberVolumeSettings = appState.volumeSettings[member._id];

        if (memberVolumeSettings && !memberVolumeSettings.audioEnabled) {
            audioRef.current.volume = 0.0;
            return;
        }

        if (mc.members.includes(appState.user._id)) {
            audioRef.current.volume = memberVolumeSettings
                ? memberVolumeSettings.volume || 1.0
                : 1.0;

            return;
        }

        const isFocused =
            appState.focusedConversation &&
            mc._id === appState.focusedConversation;
        const otherConversationFocused =
            !isFocused && !!appState.focusedConversation;

        const isMuted =
            appState.mutedConversations &&
            appState.mutedConversations.indexOf(mc.code) !== -1;

        if (otherConversationFocused || isMuted) {
            audioRef.current.volume = 0.0;
            return;
        }

        if (isFocused) {
            audioRef.current.volume = 1;
        }

        audioRef.current.volume =
            appState.backgroundConversationVolume * 0.01 * BG_CONVERSATION_MAX;
    }

    const style = useMemo(() => {
        if (isParticipating) {
            return {
                boxShadow: getBoxShadow(amplitude, index, member.avatarColor)
            };
        }
        return {
            backgroundColor: member.avatarColor || '#ffa500b3'
        };
    }, [isParticipating, member.avatarColor, amplitude, index]);

    const isMemberMutedInCommonConversation =
        isParticipating?.members.includes(appState.user._id) && member.muted;

    return (
        <div
            className={clx(
                'Member',
                ready && 'Member--ready',
                (isParticipating || welcome) && 'Member--visible',
                isParticipating && 'Member--active',
                className
            )}
            data-switching={switchingPages}
            ref={memberRef}
        >
            {isMemberBroadcasting && <Badge icon="campaign" />}
            {isMemberMutedInCommonConversation && <Badge icon="mic_off" />}
            <div
                className="Member__orb"
                onClick={ready && !isParticipating ? startConversation : null}
                style={style}
                data-drag={ready && 'disabled'}
            >
                <span className="Member__initials">{member.initials}</span>
                <MemberDoor
                    doorOpen={member.doorOpen}
                    title={member.nickname}
                />
                <audio
                    key={`${lastLogin}_${member.online}`}
                    ref={audioRef}
                    autoPlay={true}
                    playsInline={true}
                    controls={false}
                />
            </div>
            <ParticipatingModal
                isParticipating={isParticipating}
                member={member}
                user={user}
                conversations={conversations}
            />
        </div>
    );
};

export default Member;

Member.propTypes = {
    lastLogin: PropTypes.string,
    index: PropTypes.number,
    className: PropTypes.string,
    switchingPages: PropTypes.bool,
    member: PropTypes.object
};
