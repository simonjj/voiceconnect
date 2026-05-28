import React, { useState } from 'react';
import loadable from '@loadable/component';
import { TEAM_JOIN_SUCCESS, QUIT } from '../../../shared/constants';

import ipcRenderer from '../../lib/ipcRenderer';
import { createTeam, joinTeam } from '../../requests';

const Button = loadable(() =>
    import(/* webpackChunkName: "mdl-Button" */ '@material-ui/core/Button')
);

const TextField = loadable(() =>
    import(
        /* webpackChunkName: "mdl-TextField" */ '@material-ui/core/TextField'
    )
);

const InputLabel = loadable(() =>
    import(
        /* webpackChunkName: "profile-input-label" */ '@material-ui/core/InputLabel'
    )
);

const TeamSettings = () => {
    const [teamCode, setTeamCode] = useState('');
    const [newTeamName, setNewTeamName] = useState('');
    const [createError, setCreateError] = useState(false);
    const [joinTeamError, setJoinTeamError] = useState(false);

    const handleChange = (setter) => ({ target }) => {
        setJoinTeamError(false);
        setter(target.value);
    };

    async function join() {
        try {
            const team = await joinTeam(teamCode.trim());
            ipcRenderer.invoke(TEAM_JOIN_SUCCESS, team);
        } catch (error) {
            setJoinTeamError(true);
        }
    }

    async function create() {
        try {
            const { team, isCreated } = await createTeam(newTeamName.trim());
            ipcRenderer.invoke(TEAM_JOIN_SUCCESS, team, isCreated);
        } catch (e) {
            setCreateError(true);
        }
    }

    async function quit() {
        ipcRenderer.invoke(QUIT, true);
    }

    return (
        <div className="Onboarding__container Onboarding__container__team">
            <h4 className="Onboarding__title">Welcome to CONNECT!</h4>
            <p className="Onboarding__text">
                Connect is a communication app that enables remote teams to talk
                to each other effortlessly, just like when you were in the
                office together.
            </p>

            <div className="Onboarding__team">
                <p className="Onboarding__team-text">
                    Are you here to create a new team?
                </p>
                <InputLabel htmlFor="teamName">Enter Team Name: </InputLabel>
                <TextField
                    id="teamName"
                    defaultValue={newTeamName}
                    onChange={handleChange(setNewTeamName)}
                    className="mdl-textfield"
                    error={createError}
                    helperText={
                        createError &&
                        `Error creating team ${newTeamName}, please try again.`
                    }
                />
                <Button
                    disabled={!newTeamName.length}
                    onClick={create}
                    className="mdl-button mdl-button--raised mdl-button--colored"
                >
                    Create
                </Button>
            </div>

            <div className="Onboarding__team">
                <p className="Onboarding__team-text">Are you joining a team?</p>
                <InputLabel htmlFor="teamCode">Enter your code: </InputLabel>
                <TextField
                    id="teamCode"
                    defaultValue={teamCode}
                    onChange={handleChange(setTeamCode)}
                    className="mdl-textfield"
                    error={joinTeamError}
                    helperText={
                        joinTeamError && 'Invalid team code. Please try again.'
                    }
                />

                <Button
                    disabled={!teamCode.length}
                    onClick={join}
                    className="mdl-button mdl-button--raised mdl-button--colored"
                >
                    Join
                </Button>
            </div>
            <Button
                onClick={quit}
                className="mdl-button mdl-button--raised mdl-button--colored Onboarding__quit"
            >
                Quit
            </Button>
        </div>
    );
};

export default TeamSettings;
