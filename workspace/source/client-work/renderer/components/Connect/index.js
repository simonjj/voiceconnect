import React, { useEffect, useState, useRef, useMemo } from 'react';
import loadable from '@loadable/component';
import clx from 'clsx';

import { MAIN_WINDOW_BLUR, MAIN_WINDOW_FOCUS } from '../../../shared/constants';
import ConnectOffline from './Offline';

import ipcRenderer from '../../lib/ipcRenderer';

import {
    handlePointerDown,
    handlePointerUp
} from '../../utilities/dragFunctions';

import useConversations from '../../hooks/useConversations';
import useProfile from '../../hooks/useProfile';
import useTeam from '../../hooks/useTeam';
import { useOnline } from '../../hooks/useOnline';

import './style.scss';

const Me = loadable(() => import(/* webpackChunkName: "Me" */ '../Me'));
const Members = loadable(() =>
    import(/* webpackChunkName: "Members" */ '../Members')
);

const VOICECONNECT_SHRINK_DELAY = 1500;

export default () => {
    const voiceconnectRef = useRef(null);
    const [user] = useProfile();
    const [team] = useTeam();
    const [step, setStep] = useState(1);
    const [switchingPages, setSwitchingPages] = useState(false);
    const [hasFocus, setHasFocus] = useState(document.hasFocus());
    const [isClickable, setIsClickable] = useState(true);
    const { isParticipating } = useConversations(user);
    const isOnline = useOnline();

    let timer = null;
    const elem = document.documentElement;

    const onBlur = () => {
        if (isParticipating) return;

        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            elem.classList.remove('active');
            setHasFocus(false);
            setIsClickable(false);
        }, VOICECONNECT_SHRINK_DELAY);
    };

    const onFocus = () => {
        if (timer) clearTimeout(timer);
        elem.classList.add('active');
        setTimeout(() => setHasFocus(true), 10);
    };

    useEffect(() => {
        ipcRenderer.on(MAIN_WINDOW_BLUR, onBlur);
        ipcRenderer.on(MAIN_WINDOW_FOCUS, onFocus);
        window.addEventListener('focus', onFocus);
        window.addEventListener('blur', onBlur);
        onFocus();

        return () => {
            clearTimeout(timer);
            ipcRenderer.removeListener(MAIN_WINDOW_BLUR, onBlur);
            ipcRenderer.removeListener(MAIN_WINDOW_FOCUS, onFocus);
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('blur', onBlur);
        };
    }, []);

    useEffect(() => {
        const elem = document.documentElement;

        if (isParticipating) {
            elem.classList.add('active_conversation');
            onFocus();
        } else {
            elem.classList.remove('active_conversation');
        }
    }, [isParticipating]);

    const filteredTeam = useMemo(() => {
        if (user && team)
            return [...Object.values(team)].filter(
                (member) => member.id !== user._id
            );
        return [];
    }, [team]);

    const maxStep = useMemo(
        () => (filteredTeam ? Math.ceil(filteredTeam.length / 8) : 1),
        [filteredTeam]
    );

    const handleClick = (e) => {
        if (!isClickable) {
            e.stopPropagation();
            setIsClickable(true);
        }
    };

    const handleSwitchPages = () => {
        setSwitchingPages(true);
        setTimeout(() => setSwitchingPages(false), 500);
    };

    const handleStepUp = () => {
        if (step + 1 <= maxStep) {
            setStep((prevState) => prevState + 1);
        } else {
            setStep(1);
        }
        handleSwitchPages();
    };
    const handleStepDown = () => {
        if (step - 1 >= 1) {
            setStep((prevState) => prevState - 1);
        } else {
            setStep(maxStep);
        }
        handleSwitchPages();
    };

    return (
        <div
            className={clx(
                'Connect',
                !hasFocus && !isParticipating ? 'Connect_shrink' : null
            )}
            onPointerDown={(e) => handlePointerDown(e, ['dragstart'])}
            onPointerUp={() => handlePointerUp(['dragend'])}
            // TC-613 - comment out doubleClick functionality
            // onDoubleClick={(e) => handleMinimizeUI(e)}
            onClickCapture={handleClick}
            onMouseDown={() => setIsClickable(hasFocus)}
            ref={voiceconnectRef}
        >
            <Members
                user={user}
                step={step}
                team={filteredTeam}
                switchingPages={switchingPages}
                isOnline={isOnline}
            />
            {isOnline ? (
                <Me
                    user={user}
                    team={filteredTeam}
                    onStepUp={handleStepUp}
                    onStepDown={handleStepDown}
                />
            ) : (
                <ConnectOffline />
            )}
        </div>
    );
};
