import React, { useMemo, useState } from 'react';
import loadable from '@loadable/component';
import clx from 'clsx';

import ipcRenderer from '../../lib/ipcRenderer';

import Me from '../Me';
import TutorialOverlay from './tutorial-overlay';
import ConversationControl from '../VoiceConnectControls/ConversationControl';

import {
    handlePointerDown,
    handlePointerUp
} from '../../utilities/dragFunctions';

import useProfile from '../../hooks/useProfile';
import { useAppState } from '../../hooks/useAppState';

import {
    CHANGE_TUTORIAL_STEP,
    TOGGLE_TUTORIAL
} from '../../../shared/constants';
import { createMockTeam, TUTORIAL_STEPS } from './constants';

import './style.scss';

const TutorialMembers = loadable(() =>
    import(/* webpackChunkName: "Tutorial-Members" */ './tutorial-members')
);

const Tutorial = () => {
    const [user] = useProfile();
    const [appState] = useAppState();
    const [hoveredId, setHoveredId] = useState('tutorial_user_1');

    const tutorialParticipating = useMemo(() => {
        return appState.tutorial.step === 2 || appState.tutorial.step === 3;
    }, [appState.tutorial.step]);

    const team = useMemo(() => {
        if (user) {
            switch (appState.tutorial.step) {
                case 1:
                case 2:
                    return createMockTeam(
                        {
                            show: 5,
                            online: 3
                        },
                        user
                    );
                case 3:
                case 4:
                case 5:
                    return createMockTeam(
                        {
                            show: 2,
                            online: 2
                        },
                        user
                    );
                default:
                    return [];
            }
        }
        return [];
    }, [user, appState.tutorial.step]);

    const stepSettings = useMemo(() => {
        return {
            step: appState.tutorial.step,
            className: `step-${appState.tutorial.step}`
        };
    }, [appState.tutorial]);

    const handleNextStep = () => {
        if (appState.tutorial.step + 1 <= Object.keys(TUTORIAL_STEPS).length) {
            ipcRenderer.invoke(
                CHANGE_TUTORIAL_STEP,
                appState.tutorial.step + 1
            );
        }
    };

    const handlePrevStep = () => {
        if (appState.tutorial.step === 6) {
            setHoveredId('tutorial_user_1');
            return ipcRenderer.invoke(CHANGE_TUTORIAL_STEP, 4);
        }
        if (appState.tutorial.step - 1 >= 1) {
            ipcRenderer.invoke(
                CHANGE_TUTORIAL_STEP,
                appState.tutorial.step - 1
            );
        }
    };

    const hoveredMember = useMemo(() => {
        if (appState.tutorial.step && hoveredId) {
            return createMockTeam(
                {
                    show: 2,
                    online: 0
                },
                user
            ).find((member) => member._id === hoveredId);
        }
    }, [appState.tutorial.step, hoveredId, user]);

    return (
        <React.Fragment>
            <div
                className={clx('Tutorial', stepSettings.className)}
                onPointerDown={(e) => handlePointerDown(e, ['touchstart'])}
                onPointerUp={() => handlePointerUp(['touchend'])}
            >
                <TutorialOverlay
                    step={stepSettings.step}
                    onNext={handleNextStep}
                    onPrev={handlePrevStep}
                    onFinish={() => ipcRenderer.invoke(TOGGLE_TUTORIAL, true)}
                />
                <TutorialMembers
                    team={team}
                    user={user}
                    onNext={handleNextStep}
                    onHoverNext={(id) => setHoveredId(id)}
                />
                <Me
                    tutorialParticipating={tutorialParticipating}
                    tutorialAction={handleNextStep}
                    finishTutorial={() =>
                        ipcRenderer.invoke(TOGGLE_TUTORIAL, true)
                    }
                />
                {appState.tutorial.step === 5 && (
                    <ConversationControl
                        tutorial
                        tutorialAction={handleNextStep}
                        member={hoveredMember}
                    />
                )}
            </div>
        </React.Fragment>
    );
};

export default Tutorial;
