import React, { useState } from 'react';
import loadable from '@loadable/component';
import ipcRenderer from '../../lib/ipcRenderer';
import {
    CLOSE_ONBOARDING_WINDOW,
    TOGGLE_TUTORIAL
} from '../../../shared/constants';
import { reqFirstVisitState, updateUserProfile } from '../../requests';
import { useAppState } from '../../hooks/useAppState';

const Input = loadable(() =>
    import(/* webpackChunkName: "mdl-Input" */ '@material-ui/core/TextField')
);

const Button = loadable(() =>
    import(/* webpackChunkName: "mdl-Button" */ '@material-ui/core/Button')
);

const Tutorial = () => {
    const [appState] = useAppState();

    const [firstName = '', setFirstName] = useState(appState.user.firstName);
    const [lastName = '', setLastName] = useState(appState.user.lastName);

    const closeOnboardingWindow = async () => {
        try {
            await reqFirstVisitState();
            await updateUserProfile({
                firstName: firstName.trim(),
                lastName: lastName.trim()
            });
        } catch (error) {
            console.log(error);
        } finally {
            ipcRenderer.invoke(CLOSE_ONBOARDING_WINDOW, true);
        }
    };

    const openTutorialWindow = async () => {
        try {
            await updateUserProfile({
                firstName: firstName.trim(),
                lastName: lastName.trim()
            });
        } catch (error) {
            console.log(error.message);
        } finally {
            ipcRenderer.invoke(CLOSE_ONBOARDING_WINDOW);
            ipcRenderer.invoke(TOGGLE_TUTORIAL, false);
        }
    };

    return (
        <div className="Onboarding__container Onboarding__container__tutorial">
            <h4 className="Onboarding__title">
                We tried to make Connect as easy and intuitive as possible, but
                we’d still like to show you around.
            </h4>
            <p className="Onboarding__text">
                Would you like to see a brief tutorial?
            </p>
            <div className="Onboarding__form-section">
                <Input
                    type="text"
                    id="firstName"
                    className="mdl-textfield"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    label="First Name"
                />
                <Input
                    type="text"
                    id="lastName"
                    className="mdl-textfield"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    label="Last Name"
                />
            </div>
            <div className="Onboarding__controls Onboarding__controls">
                <Button
                    type="button"
                    className="mdl-button mdl-button--raised mdl-button--colored"
                    disabled={!firstName.trim() || !lastName.trim()}
                    onClick={openTutorialWindow}
                >
                    YES, show me around
                </Button>

                <Button
                    type="button"
                    className="mdl-button mdl-button--raised mdl-button--colored"
                    disabled={!firstName.trim() || !lastName.trim()}
                    onClick={closeOnboardingWindow}
                >
                    NO, I’ll figure it out
                </Button>
            </div>
        </div>
    );
};

export default Tutorial;
