import React from 'react';
import loadable from '@loadable/component';
import {
    ONBOARDING_STATES,
    UPDATE_ONBOARDING_STATE
} from '../../../shared/constants';
import ipcRenderer from '../../lib/ipcRenderer';

const Button = loadable(() =>
    import(/* webpackChunkName: "mdl-Button" */ '@material-ui/core/Button')
);

const OnboardingMain = () => {
    const updateOnboardingState = (state) => {
        ipcRenderer.invoke(UPDATE_ONBOARDING_STATE, state);
    };

    return (
        <div className="Onboarding__container Onboarding__container__main">
            <h4 className="Onboarding__title">
                Connect helps you and your team stay connected and collaborating
            </h4>
            <p className="Onboarding__text">
                Would you like to invite the rest of your team?
            </p>
            <div className="OnboardingMain__controls Onboarding__controls">
                <Button
                    type="button"
                    className="mdl-button mdl-button--raised mdl-button--colored"
                    onClick={() =>
                        updateOnboardingState(ONBOARDING_STATES.INVITATION)
                    }
                >
                    YES, let’s invite my team
                </Button>

                <Button
                    type="button"
                    className="mdl-button mdl-button--raised mdl-button--colored"
                    onClick={() =>
                        updateOnboardingState(ONBOARDING_STATES.TUTORIAL)
                    }
                >
                    NO, I’ll invite them later
                </Button>
            </div>
        </div>
    );
};

export default OnboardingMain;
