import { updateTeamOwner } from '../../requests';
import React from 'react';
import loadable from '@loadable/component';
import propTypes from 'prop-types';
import Paper from '@material-ui/core/Paper';

const TextField = loadable(() =>
    import(/* webpackChunkName: "TextField" */ '@material-ui/core/TextField')
);

const InputLabel = loadable(() =>
    import(/* webpackChunkName: "InputLabel" */ '@material-ui/core/InputLabel')
);

const Autocomplete = loadable(() =>
    import(
        /* webpackChunkName: "Autocomplete" */ '@material-ui/lab/Autocomplete'
    )
);

const Button = loadable(() =>
    import(/* webpackChunkName: "Button" */ '@material-ui/core/Button')
);

const TransferOwnerRights = ({
    isUserOwner,
    classes,
    teamMembers,
    teamCode
}) => {
    const [member, setMember] = React.useState(null);

    const handleSelectValueChange = (_, member) => {
        if (member) {
            setMember(member);
        }
    };
    const handleButtonClick = async () => {
        await updateTeamOwner(member._id, teamCode);
        setMember(null);
    };

    return (
        <div className="o-form__field">
            <div className={classes.teamStatusBlock}>
                {isUserOwner && (
                    <>
                        <div className="owner-container">
                            <InputLabel id="selectNewOwnerLabel">
                                Transfer Owner rights
                            </InputLabel>

                            <Autocomplete
                                id="selectOwnerInput"
                                value={member}
                                onChange={handleSelectValueChange}
                                options={teamMembers}
                                getOptionLabel={(option) => option.email}
                                disablePortal
                                blurOnSelect
                                disableClearable
                                className="o-form__select"
                                renderInput={(params) => (
                                    <TextField
                                        placeholder="Select Member"
                                        {...params}
                                    />
                                )}
                                PaperComponent={(params) => (
                                    <Paper elevation={8} {...params} />
                                )}
                                onKeyDownCapture={(event) =>
                                    event.preventDefault()
                                }
                            />
                        </div>

                        <Button
                            disabled={member === null}
                            className="mdl-button mdl-button--raised  mdl-button--colored"
                            onClick={handleButtonClick}
                        >
                            {' '}
                            Save changes
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
};

TransferOwnerRights.propTypes = {
    isUserOwner: propTypes.bool,
    classes: propTypes.object,
    teamMembers: propTypes.array,
    teamCode: propTypes.string
};

export default TransferOwnerRights;
