import React from 'react';
import propTypes from 'prop-types';
import loadable from '@loadable/component';

import Paper from '@material-ui/core/Paper';
import { Checkbox, Tooltip } from '@material-ui/core';

const Input = loadable(() =>
    import(/* webpackChunkName: "profile-input" */ '@material-ui/core/Input')
);
const InputLabel = loadable(() =>
    import(
        /* webpackChunkName: "profile-input-label" */ '@material-ui/core/InputLabel'
    )
);
const Button = loadable(() =>
    import(/* webpackChunkName: "profile-button" */ '@material-ui/core/Button')
);

const Autocomplete = loadable(() =>
    import(
        /* webpackChunkName: "mdl-Autocomplete" */ '@material-ui/lab/Autocomplete'
    )
);

const TextField = loadable(() =>
    import(
        /* webpackChunkName: "mdl-TextField" */ '@material-ui/core/TextField'
    )
);

export const ProfileForm = ({ user, onChange, onSubmit }) => {
    const defaultDoorOptions = [
        { label: 'Not selected', value: '' },
        { label: 'Open door', value: true },
        { label: 'Close door', value: false }
    ];

    const userDefaultDoor = defaultDoorOptions.find((state) => {
        return state.value === user.defaultDoor;
    });
    const tooltipTitleForKnock = `Use this button if you want other user to always knock at your door (even if it's open)`;
    const label = { inputProps: { 'aria-label': 'Switch demo' } };

    const handleChange = (event) => {
        const { value, name } = event.target;
        onChange({ ...user, [name]: value });
    };

    return (
        <form
            className="p-form"
            onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
            }}
        >
            <div className="p-form__section">
                <InputLabel htmlFor="firstName">First Name</InputLabel>
                <Input
                    type="text"
                    name="firstName"
                    id="firstName"
                    value={user.firstName}
                    onChange={handleChange}
                />
            </div>
            <div className="p-form__section">
                <InputLabel htmlFor="lastName">Last Name</InputLabel>
                <Input
                    type="text"
                    name="lastName"
                    id="lastName"
                    value={user.lastName}
                    onChange={handleChange}
                />
            </div>
            <div className="p-form__section">
                <InputLabel htmlFor="nickName">Nickname</InputLabel>
                <Input
                    type="text"
                    name="nickname"
                    id="nickName"
                    value={user.nickname}
                    onChange={handleChange}
                />
            </div>
            <div className="p-form__section">
                <div style={{ display: 'flex' }}>
                    <div>
                        <InputLabel htmlFor="selectDefaultDoor">
                            Default door state
                        </InputLabel>
                        <Autocomplete
                            id="selectDefaultDoor"
                            value={userDefaultDoor}
                            onChange={(_, { value }) =>
                                onChange({
                                    ...user,
                                    defaultDoor: value
                                })
                            }
                            options={defaultDoorOptions}
                            getOptionLabel={(option) => option.label}
                            disablePortal
                            blurOnSelect
                            disableClearable
                            className="o-form__select"
                            renderInput={(params) => <TextField {...params} />}
                            PaperComponent={(params) => (
                                <Paper elevation={8} {...params} />
                            )}
                            onKeyDownCapture={(event) => event.preventDefault()}
                        />
                    </div>
                    <div>
                        <InputLabel htmlFor="selectRequireKnock">
                            Always require knock
                        </InputLabel>
                        <Tooltip title={tooltipTitleForKnock}>
                            <span style={{ marginLeft: '-10px' }}>
                                <Checkbox
                                    {...label}
                                    id="selectRequireKnock"
                                    className="checkbox__knock"
                                    checked={user.isKnockRequired}
                                    onChange={(e) => {
                                        onChange({
                                            ...user,
                                            isKnockRequired: e.target.checked
                                        });
                                    }}
                                />
                            </span>
                        </Tooltip>
                    </div>
                </div>
            </div>

            <Button
                type="submit"
                className="mdl-button mdl-button--raised mdl-button--colored"
                disabled={user.nickname.trim().length < 2}
            >
                Save changes
            </Button>
        </form>
    );
};

ProfileForm.propTypes = {
    user: propTypes.object,
    onChange: propTypes.func,
    onSubmit: propTypes.func
};
