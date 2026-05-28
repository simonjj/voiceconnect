const Team = require('../../models/Team');
const User = require('../../models/User');

const {
    sendMemberList,
    sendUpdatedTeamProp
} = require('../../lib/TeamService');

const teams = async (req, res) => {
    const teams = await Team.find();
    res.json(teams);
};

const create = async (req, res) => {
    const { isPrivate, name } = req.body;

    let team = await Team.findOne({ name });
    if (!team) team = await Team.findOne({ code: name });

    let isCreated = false;

    if (!team) {
        team = new Team({
            ...req.body,
            owner: req.user._id
        });
        isCreated = true;
    }

    if (isPrivate) {
        if (isCreated) {
            await team.invitedMembers.addToSet(req.user._id);
        } else {
            return res.status(400).json({
                error: 'permissions_error',
                message: 'An error occurred while creating your team.'
            });
        }
    }

    await team.members.addToSet(req.user._id);
    await team.save();
    await req.user.set('team', team._id);
    await req.user.save();

    await sendMemberList(team.code);

    if (team) {
        team.members = team.members.filter(
            (m) => m._id.toString() !== req.user._id.toString()
        );
    }

    res.json({ team, isCreated });
};

const setAdmin = async (req, res) => {
    try {
        const { code } = req.params;
        const { id } = req.body;
        const team = await Team.findOne({ code });
        const member = await User.findById(id);
        const isUserOwner = team.owner.toString() === req.user._id.toString();

        if (isUserOwner) {
            await team.admins.addToSet(member.id);
            const updatedTeam = await team.save();
            await sendUpdatedTeamProp(code, { admins: updatedTeam.admins });
        } else {
            return res.status(400).json({
                error: 'permissions_error'
            });
        }

        res.send('OK');
    } catch (error) {
        return res.status(400).json({
            error: 'something_went_wrong',
            message: error.message
        });
    }
};

const unsetAdmin = async (req, res) => {
    try {
        const { code } = req.params;
        const { id } = req.body;
        const team = await Team.findOne({ code });
        const isUserOwner = team.owner.toString() === req.user._id.toString();

        if (isUserOwner) {
            team.admins.pull(id);
            const updatedTeam = await team.save();
            await sendUpdatedTeamProp(code, { admins: updatedTeam.admins });
        } else {
            return res.status(400).json({
                error: 'permissions_error'
            });
        }

        res.send('OK');
    } catch (error) {
        return res.status(400).json({
            error: 'something_went_wrong',
            message: error.message
        });
    }
};

const updateOwner = async (req, res) => {
    try {
        const { code } = req.params;
        const { id } = req.body;
        const team = await Team.findOne({ code });
        const isMemberInTeam = team.members.find((member) => id === member._id);
        const isUserOwner =
            team.owner._id.toString() === req.user._id.toString();

        if (isUserOwner && isMemberInTeam) {
            await team.set('owner', id);
            const updatedTeam = await team.save();
            await sendUpdatedTeamProp(code, { owner: updatedTeam.owner });
        } else {
            return res.status(400).json({
                error: 'permissions_error'
            });
        }

        res.send('OK');
    } catch (error) {
        return res.status(400).json({
            error: 'something_went_wrong',
            message: error.message
        });
    }
};

const inviteMember = async (req, res) => {
    try {
        const { code } = req.params;
        const { email } = req.body;
        const team = await Team.findOne({ code });
        const member = await User.findOne({ email });

        const isUserOwner =
            team.owner._id.toString() === req.user._id.toString();
        const isUserAdmin = team.admins.indexOf(req.user._id) !== -1;

        if (isUserOwner || isUserAdmin) {
            await team.invitedMembers.addToSet(member);
            await team.save();
        } else {
            return res.status(400).json({
                error: 'permissions_error'
            });
        }
        res.send('OK');
    } catch (error) {
        return res.status(400).json({
            error: 'something_went_wrong',
            message: error.message
        });
    }
};

const removeMember = async (req, res) => {
    try {
        const { code } = req.params;
        const { id } = req.body;
        const team = await Team.findOne({ code });
        const member = await User.findById(id);

        const isUserOwner =
            team.owner._id.toString() === req.user._id.toString();
        const isUserAdmin = team.admins.indexOf(req.user._id) !== -1;

        const isMemberOwner =
            team.owner._id.toString() === member._id.toString();

        if ((isUserOwner || isUserAdmin) && !isMemberOwner) {
            await team.members.pull({ _id: id });
            await team.invitedMembers.pull({ _id: id });
            await team.admins.pull({ _id: id });
            const updatedTeam = await team.save();
            await member.set('team', undefined);
            await member.save();
            await sendMemberList(code);
            await sendUpdatedTeamProp(code, { admins: updatedTeam.admins });
        } else {
            return res.status(400).json({
                error: 'permissions_error'
            });
        }

        res.send('OK');
    } catch (error) {
        return res.status(400).json({
            error: 'something_went_wrong',
            message: error.message
        });
    }
};

const removeTeam = async (req, res) => {
    try {
        const { code } = req.params;
        const team = await Team.findOne({ code });
        const isUserOwner =
            team.owner._id.toString() === req.user._id.toString();

        if (isUserOwner) {
            for (const memberId of team.members) {
                const member = User.findById(memberId);
                member.team = undefined;
                await member.save;
            }
            await team.delete();
            await sendMemberList(code);
        }

        res.send('OK');
    } catch (error) {
        return res.status(400).json({
            error: 'something_went_wrong',
            message: error.message
        });
    }
};

const join = async (req, res) => {
    try {
        const { code } = req.params;
        const team = await Team.findOne({ code });

        if (team) {
            let isInvited = team.isPrivate
                ? team.invitedMembers.indexOf(req.user._id) !== -1
                : true;

            if (isInvited) {
                await team.members.addToSet(req.user._id);
                await team.save();
                await req.user.set('team', team._id);
                await req.user.save();
                await sendMemberList(code);
            } else {
                return res.status(400).json({
                    error: 'permissions_error',
                    message: 'Need permission to join, invite only'
                });
            }

            team.members = team.members.filter(
                (m) => m._id.toString() !== req.user._id.toString()
            );

            res.json(team);
        } else {
            return res.status(400).json({
                error: 'team_join_error',
                message: 'Team with this code does not exist'
            });
        }
    } catch (error) {
        return res.status(400).json({
            error: 'something_went_wrong',
            message: error.message
        });
    }
};
const leave = async (req, res) => {
    const { code } = req.params;
    await Team.updateOne({ code }, { $pull: { members: req.user._id } });
    req.user.team = undefined;
    await req.user.save();
    sendMemberList(code);
    res.send('OK');
};

const updatePrivacyState = async (req, res) => {
    try {
        const { code, state } = req.params;
        const team = await Team.findOne({ code });

        const isUserOwner = team.owner.toString() === req.user._id.toString();
        const newPrivacyState = JSON.parse(state);

        if (isUserOwner && newPrivacyState !== team.get('isPrivate')) {
            await team.set('isPrivate', newPrivacyState);
            await team.save();
            await sendUpdatedTeamProp(code, { isPrivate: newPrivacyState });
        }

        res.end('OK');
    } catch (error) {
        return res.status(400).json({
            error: 'something_went_wrong',
            message: error.message
        });
    }
};

module.exports = {
    teams,
    create,
    setAdmin,
    unsetAdmin,
    updateOwner,
    inviteMember,
    updatePrivacyState,
    removeMember,
    removeTeam,
    join,
    leave
};
