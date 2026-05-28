import React, { useState, useEffect, useMemo } from 'react';

import useConversations from '../../hooks/useConversations';
import useProfile from '../../hooks/useProfile';

import { stringToHexColor } from '../../../main/utils/participatingColors';

import './style.scss';
import clx from 'clsx';
import { useAppState } from '../../hooks/useAppState';
import { TUTORIAL_PARTICIPATING_CODE } from '../Tutorial/constants';

const Door = ({ finishTutorial }) => {
    const [{ doorOpen }, { toggleDoor }] = useProfile();
    const [appState] = useAppState();

    return (
        <i
            className="User__door material-icons md-36"
            data-drag="disabled"
            onClick={appState.tutorial.step === 6 ? finishTutorial : toggleDoor}
        >
            {doorOpen ? 'meeting_room' : 'sensor_door'}
        </i>
    );
};

const Megaphone = ({ startBroadcast }) => {
    return (
        <i
            className="User__megaphone material-icons md-36"
            onClick={startBroadcast}
            data-drag="disabled"
        >
            campaign
        </i>
    );
};

const Microphone = () => {
    const [{ muted }, { toggleMute }] = useProfile();

    return (
        <i
            className="material-icons md-36 md-light"
            data-drag="disabled"
            onClick={toggleMute}
        >
            {muted ? 'mic_off' : 'mic'}
        </i>
    );
};

const Private = ({ isPrivate }) => {
    const { makePrivate } = useConversations();
    return (
        <i
            className="material-icons md-36 md-light"
            data-drag="disabled"
            onClick={makePrivate}
            title={
                isPrivate
                    ? 'Conversation is private'
                    : 'Conversation is open to team'
            }
        >
            {isPrivate ? 'lock' : 'lock_open'}
        </i>
    );
};

const Leave = ({ tutorialParticipating = false, tutorialAction = false }) => {
    const { leaveConversations } = useConversations();
    return (
        <i
            className="material-icons md-36 md-light"
            data-drag="disabled"
            onClick={
                tutorialParticipating ? tutorialAction : leaveConversations
            }
        >
            cancel
        </i>
    );
};

const NavigateNext = ({ action, isParticipating }) => {
    return (
        <i
            className={clx(
                'material-icons md-36 icon-navigate',
                isParticipating && 'md-light'
            )}
            data-drag="disabled"
            onClick={action}
        >
            navigate_next
        </i>
    );
};

const NavigateBefore = ({ action, isParticipating }) => {
    return (
        <i
            className={clx(
                'material-icons md-36 icon-navigate',
                isParticipating && 'md-light'
            )}
            data-drag="disabled"
            onClick={action}
        >
            navigate_before
        </i>
    );
};

const Me = ({
    team,
    user,
    onStepUp,
    onStepDown,
    tutorialParticipating = false,
    tutorialAction = () => null,
    finishTutorial = () => null
}) => {
    const { isParticipating, startBroadcast } = useConversations(user);
    const [backgroundColor, setBackgroundColor] = useState(null);

    const isTeamOverflow = useMemo(() => {
        if (team) return team.length > 8;
    }, [team]);

    useEffect(() => {
        if (isParticipating) {
            setBackgroundColor(stringToHexColor(isParticipating.code));
        } else setBackgroundColor(null);
    }, [isParticipating]);

    const style = useMemo(() => {
        if (tutorialParticipating) {
            return {
                backgroundColor: stringToHexColor(TUTORIAL_PARTICIPATING_CODE)
            };
        }
        return {
            backgroundColor
        };
    }, [tutorialParticipating, backgroundColor]);

    return (
        <span className="User">
            <div className="User__shadow" />
            <div className="User__orb" style={style}>
                <div className="flexbox-center">
                    {isTeamOverflow && (
                        <NavigateBefore
                            action={onStepDown}
                            isParticipating={isParticipating}
                        />
                    )}
                    {tutorialParticipating || isParticipating ? (
                        <div className="conversation-icons">
                            <div style={{ display: 'flex' }}>
                                <Microphone />
                                <Private
                                    isPrivate={
                                        tutorialParticipating
                                            ? false
                                            : isParticipating.private
                                    }
                                />
                            </div>
                            <hr />
                            <Leave
                                tutorialParticipating={tutorialParticipating}
                                tutorialAction={tutorialAction}
                            />
                        </div>
                    ) : (
                        <div
                            className={clx(
                                'User__orb-icons',
                                'User__main-icons'
                            )}
                        >
                            <div className="User__orb-icons__control">
                                <Door finishTutorial={finishTutorial} />
                                <hr />
                                <Megaphone startBroadcast={startBroadcast} />
                            </div>
                        </div>
                    )}
                    {isTeamOverflow && (
                        <NavigateNext
                            action={onStepUp}
                            isParticipating={isParticipating}
                        />
                    )}
                </div>
            </div>
        </span>
    );
};

export default Me;
