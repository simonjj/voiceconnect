import React, { useMemo } from 'react';
import { useAppState } from '../../../hooks/useAppState';

const MemberDoor = ({ title }) => {
    return (
        <i className="Member__icons material-icons" title={title}>
            meeting_room
        </i>
    );
};

const TutorialMember = ({ member, onNext, onHoverNext, index }) => {
    const [appState] = useAppState();

    const handleNextTutorialStep = () => {
        if (appState.tutorial.step === 4) {
            onHoverNext(member._id);
            onNext();
        }
        return null;
    };

    const isActive = useMemo(() => {
        return (
            (appState.tutorial.step === 1 && index === 0) ||
            (appState.tutorial.step === 2 && index === 1)
        );
    }, [appState.tutorial.step, index]);

    return (
        <div className="Member Member--ready">
            <div
                className="Member__orb"
                onClick={onNext}
                onPointerEnter={handleNextTutorialStep}
                data-drag={isActive && 'disabled'}
            >
                <span className="Member__initials">{member.initials}</span>
                <MemberDoor title={member.nickname} />
            </div>
        </div>
    );
};

export default TutorialMember;
