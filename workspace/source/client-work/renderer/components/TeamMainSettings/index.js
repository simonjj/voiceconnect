import React from 'react';
import clsx from 'clsx';
import propTypes from 'prop-types';
import { useAppState } from '../../hooks/useAppState';
import { useTeamMembers } from '../../hooks/useTeamMembers';
import loadable from '@loadable/component';
import { withStyles, makeStyles } from '@material-ui/core/styles';
import TableCell from '@material-ui/core/TableCell';
import TableRow from '@material-ui/core/TableRow';
import TransferOwnerRights from './transferOwnerRights';
import TeamPrivacyButtons from './teamPrivacyButtons';
import { Chip } from '@material-ui/core';

const Table = loadable(() =>
    import(/* webpackChunkName: "Table" */ '@material-ui/core/Table')
);

const TableContainer = loadable(() =>
    import(
        /* webpackChunkName: "TableContainer" */ '@material-ui/core/TableContainer'
    )
);

const TableHead = loadable(() =>
    import(/* webpackChunkName: "TableHead" */ '@material-ui/core/TableHead')
);

const Paper = loadable(() =>
    import(/* webpackChunkName: "Paper" */ '@material-ui/core/Paper')
);

const TeamMembersList = loadable(() =>
    import(/* webpackChunkName: "MenuItem" */ './teamMembersList')
);

const StyledTableCell = withStyles(() => ({
    head: {
        backgroundColor: '#183d45',
        color: 'white'
    },
    body: {
        fontSize: 14,
        color: '#183d45'
    }
}))(TableCell);

const useStyles = makeStyles({
    table: {
        minWidth: 700
    },
    teamStatusBlock: {
        marginTop: '20px',
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-end'
    },
    mainBlock: {
        display: 'flex',
        flexDirection: 'column',
        minHeight: '400px'
    },
    teamCode: {
        'backgroundColor': '#183d45',
        'marginBottom': '5px',
        'color': 'white',
        'fontSize': 14,
        '&:hover, &:focus': {
            backgroundColor: '#183d45',
            color: '#183d45'
        }
    }
});

const TeamMainSettings = ({ className }) => {
    const classes = useStyles();
    const [appState] = useAppState();
    const teamMembers = useTeamMembers();
    const teamCode = appState.team.code;
    const admins = appState.team.admins;
    const isAdmin = admins.includes(admins.id);
    const isUserOwner = appState.user.id === appState.team.owner;

    async function copyTeamCodeToClip() {
        await navigator.clipboard.writeText(teamCode);
    }

    return (
        <div className={clsx('settings-main', className, classes.mainBlock)}>
            {(isUserOwner || isAdmin) && (
                <Chip
                    className={classes.teamCode}
                    label={`Click to copy your team code to clipboard`}
                    onClick={() => copyTeamCodeToClip()}
                    variant="outlined"
                />
            )}
            <TableContainer component={Paper}>
                <Table className={classes.table} aria-label="customized table">
                    <TableHead className="table-header">
                        <TableRow>
                            <StyledTableCell>Team member Email</StyledTableCell>
                            <StyledTableCell align="left">
                                Nickname
                            </StyledTableCell>
                            <StyledTableCell align="center">
                                Role
                            </StyledTableCell>
                            <StyledTableCell align="center">
                                Ability to remove
                            </StyledTableCell>
                            {isUserOwner && (
                                <StyledTableCell align="center">
                                    Ability to update an admin status
                                </StyledTableCell>
                            )}
                        </TableRow>
                    </TableHead>
                    <TeamMembersList
                        appState={appState}
                        isUserOwner={isUserOwner}
                        teamCode={teamCode}
                        teamMembers={teamMembers}
                    />
                </Table>
            </TableContainer>
            <TransferOwnerRights
                isUserOwner={isUserOwner}
                classes={classes}
                teamMembers={teamMembers}
                teamCode={teamCode}
            />
            <TeamPrivacyButtons
                appState={appState}
                classes={classes}
                teamCode={teamCode}
                isUserOwner={isUserOwner}
            />
        </div>
    );
};

TeamMainSettings.propTypes = {
    className: propTypes.string
};

export default TeamMainSettings;
