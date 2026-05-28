import { removeTeamMember, setAdmin, unsetAdmin } from '../../requests';
import React, { useState } from 'react';
import propTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import TableCell from '@material-ui/core/TableCell';
import loadable from '@loadable/component';
import TableRow from '@material-ui/core/TableRow';

const TableBody = loadable(() =>
    import(/* webpackChunkName: "TableBody" */ '@material-ui/core/TableBody')
);

const Button = loadable(() =>
    import(/* webpackChunkName: "Button" */ '@material-ui/core/Button')
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

const StyledTableRow = withStyles((theme) => ({
    root: {
        '&:nth-of-type(odd)': {
            backgroundColor: theme.palette.action.hover
        }
    }
}))(TableRow);

const RemoveMemberItem = ({ item, teamCode }) => {
    const [confirm, setConfirm] = useState(false);

    return (
        <>
            <StyledTableCell align="center">
                {!confirm ? (
                    <Button
                        className="mdl-button mdl-button--raised  mdl-button--colored"
                        onClick={() => setConfirm(true)}
                    >
                        Remove member
                    </Button>
                ) : (
                    <>
                        <p>Are you sure?</p>
                        <Button
                            className="mdl-button mdl-button--raised  mdl-button--colored"
                            onClick={() => removeTeamMember(item.id, teamCode)}
                        >
                            Yes
                        </Button>
                        <Button
                            className="mdl-button mdl-button--raised  mdl-button--colored"
                            onClick={() => setConfirm(false)}
                        >
                            No
                        </Button>
                    </>
                )}
            </StyledTableCell>
        </>
    );
};

const TeamMembersList = ({ appState, isUserOwner, teamCode, teamMembers }) => {
    const admins = appState.team.admins;

    const listItems = teamMembers.map((item) => {
        const isAdmin = admins.includes(item.id);
        const isOwner = item.id == appState.team.owner;
        const removeMemberButton = isOwner ? (
            <StyledTableCell align="center"> </StyledTableCell>
        ) : (
            <RemoveMemberItem teamCode={teamCode} item={item} />
        );
        const removeAdminButtons = isAdmin ? (
            <StyledTableCell align="center">
                <Button
                    className="mdl-button mdl-button--raised  mdl-button--colored"
                    onClick={() => unsetAdmin(item.id, teamCode)}
                >
                    Unset Admin
                </Button>
            </StyledTableCell>
        ) : (
            <StyledTableCell align="center">
                <Button
                    className="mdl-button mdl-button--raised  mdl-button--colored"
                    onClick={() => setAdmin(item.id, teamCode)}
                >
                    Set Admin
                </Button>
            </StyledTableCell>
        );

        const role = (isOwner && 'Owner') || (isAdmin && 'Admin') || 'Member';

        return (
            <StyledTableRow key={item.id}>
                <StyledTableCell component="th" scope="row">
                    {item.email}
                </StyledTableCell>
                <StyledTableCell align="left">{item.nickname}</StyledTableCell>
                <StyledTableCell align="center">{role}</StyledTableCell>
                {removeMemberButton}
                {isUserOwner && removeAdminButtons}
            </StyledTableRow>
        );
    });

    return <TableBody>{listItems}</TableBody>;
};

TeamMembersList.propTypes = {
    isUserOwner: propTypes.bool,
    appState: propTypes.object,
    teamCode: propTypes.string,
    teamMembers: propTypes.array
};

RemoveMemberItem.propTypes = {
    item: propTypes.any,
    teamCode: propTypes.string
};

export default TeamMembersList;
