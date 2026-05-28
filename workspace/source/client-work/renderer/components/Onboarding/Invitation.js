import React, { useState } from 'react';
import ipcRenderer from '../../lib/ipcRenderer';
import {
    UPDATE_ONBOARDING_STATE,
    ONBOARDING_STATES,
    CLOSE_ONBOARDING_WINDOW
} from '../../../shared/constants';

import loadable from '@loadable/component';
import { useAppState } from '../../hooks/useAppState';
import { createInvitations } from '../../requests';

const TextField = loadable(() =>
    import(
        /* webpackChunkName: "mdl-TextField" */ '@material-ui/core/TextField'
    )
);

const InputLabel = loadable(() =>
    import(
        /* webpackChunkName: "mdl-InputLabel" */ '@material-ui/core/InputLabel'
    )
);

const TextareaAutosize = loadable(() =>
    import(
        /* webpackChunkName: "mdl-TextAreaAutosize" */ '@material-ui/core/TextareaAutosize'
    )
);

const Button = loadable(() =>
    import(/* webpackChunkName: "mdl-Button" */ '@material-ui/core/Button')
);

const Invitation = () => {
    const [appState] = useAppState();

    const teamName = appState.team.name || appState.team.code;

    const [error, setError] = useState({
        status: false,
        errorMessage: ''
    });
    const [onboarding, setInvitation] = useState({
        receivers: '',
        message: ''
    });

    const updateOnboardingState = () => {
        if (appState.firstVisit) {
            ipcRenderer.invoke(
                UPDATE_ONBOARDING_STATE,
                ONBOARDING_STATES.TUTORIAL
            );
        } else {
            ipcRenderer.invoke(CLOSE_ONBOARDING_WINDOW);
        }
    };

    function validateEmails() {
        const regex = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        let hasError = true;
        for (let item of onboarding.receivers.split(' ')) {
            if (!regex.test(item)) {
                hasError = false;
                return;
            }
        }
        return hasError;
    }

    const sendInvitations = async (event) => {
        event.preventDefault();
        if (validateEmails()) {
            try {
                await createInvitations({
                    message: onboarding.message,
                    receivers: onboarding.receivers.split(' ')
                });
                updateOnboardingState();
                setInvitation({ message: '', receivers: '' });
            } catch (error) {
                console.error(error);
            }
        } else {
            setError({ status: true, errorMessage: 'Invalid email' });
        }
    };

    return (
        <div className="Onboarding__container Onboarding__container__invitation">
            <h4 className="Onboarding__title">
                Invite members to the {teamName}
            </h4>

            <form
                className="Onboarding__form"
                onSubmit={sendInvitations}
                onReset={updateOnboardingState}
            >
                <div className="Onboarding__form-section">
                    <InputLabel
                        className="Onboarding__form-label"
                        htmlFor="receivers"
                    >
                        Emails (separated by space)
                    </InputLabel>
                    <TextField
                        label={error.errorMessage}
                        error={error.status}
                        className="mdl-textfield"
                        name="receivers"
                        id="receivers"
                        variant="outlined"
                        value={onboarding.receivers}
                        onFocus={() =>
                            setError({ status: false, errorMessage: '' })
                        }
                        onChange={({ target }) => {
                            setInvitation({
                                ...onboarding,
                                receivers: target.value
                            });
                        }}
                    />
                </div>
                <div className="Onboarding__form-section">
                    <InputLabel
                        className="Onboarding__form-label"
                        htmlFor="message"
                    >
                        Send an invite message (optional)
                    </InputLabel>
                    <TextareaAutosize
                        className="mdl-textarea"
                        id="message"
                        rowsMin={5}
                        rowsMax={5}
                        value={onboarding.message}
                        onChange={({ target }) => {
                            setInvitation({
                                ...onboarding,
                                message: target.value
                            });
                        }}
                    />
                </div>
                <div className="Onboarding__controls">
                    <Button
                        type="reset"
                        className="mdl-button mdl-button--raised mdl-button--colored"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        className="mdl-button mdl-button--raised mdl-button--colored"
                        disabled={!onboarding.receivers}
                    >
                        Send
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default Invitation;
