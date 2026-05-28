import React, { useMemo } from 'react';
import propTypes from 'prop-types';
import TeamSettings from './TeamSettings';
import OnboardingMain from './OnboardingMain';
import Invitation from './Invitation';
import Tutorial from './Tutorial';
import { useAppState } from '../../hooks/useAppState';
import { ONBOARDING_STATES } from '../../../shared/constants';

import './style.scss';

const OnboardingView = ({ view }) => {
    switch (view) {
        case ONBOARDING_STATES.MAIN:
            return <OnboardingMain />;
        case ONBOARDING_STATES.INVITATION:
            return <Invitation />;
        case ONBOARDING_STATES.TUTORIAL:
            return <Tutorial />;
        default:
            return <TeamSettings />;
    }
};

OnboardingView.propTypes = {
    view: propTypes.oneOf([
        ONBOARDING_STATES.MAIN,
        ONBOARDING_STATES.INVITATION,
        ONBOARDING_STATES.TUTORIAL
    ])
};

const Onboarding = () => {
    const [appState] = useAppState();
    const onboardingState = useMemo(() => {
        return appState.onboardingState;
    }, [appState.onboardingState]);

    return (
        <div className="Onboarding">
            <OnboardingView view={onboardingState} />
        </div>
    );
};

export default Onboarding;
