const debug = require('debug')('ttc:conversations:handlers');

const { produce } = require('../../lib/kafka');
const { acceptKnock, declineKnock, registerKnock } = require('../../lib/Knock');
const { unmuteUser } = require('../../lib/mute');

const Conversation = require('../../models/Conversation');
const User = require('../../models/User');
const { restoreWindow, minimizeWindow } = require('../../lib/minimize-window');

const { updateMutedState } = require('../users/handlers');

const produceConversationChange = async (req, res) => {
    if (res && !res.dirty) return;
    if (!req.user.team) return;
    const {
        user: {
            team: { _id: team, code }
        }
    } = req;

    // Truncate conversations that have one or less members
    await Conversation.deleteMany({
        $or: [
            {
                team,
                members: { $exists: false }
            },
            {
                team,
                members: { $exists: true, $size: 0 }
            },
            {
                team,
                members: { $exists: true, $size: 1 },
                isBroadcast: false
            }
        ]
    });

    const conversations = await Conversation.find({ team });

    await produce({
        code,
        event: 'conversation-change',
        data: { conversations }
    });
};

const leaveConversations = async (user) => {
    const {
        team: { _id: team }
    } = user;

    await Conversation.updateMany({ team }, { $pull: { members: user._id } });
    produceConversationChange({ user });
};

const getConversationsByTeam = async (req, res) => {
    const { user } = req;

    const conversations = await Conversation.find({ team: user.team }).exec();

    res.json(conversations);
};

const createConversation = async (req, res) => {
    const { _id: user, team } = req.user;
    const { isBroadcast } = req.body;
    const { knock } = req;

    let member = null;
    let members = [user];

    if (!isBroadcast) {
        member = await User.findById(req.body.targetUser);
        if (!member) return res.end();

        members.push(member);
        const existing = JSON.parse(
            JSON.stringify(
                await Conversation.find({
                    members: { $in: [user, member._id] },
                    team
                })
            )
        );
        const uc = existing.find(
            (c) => c.members.indexOf(user.toString()) !== -1
        );
        const mc = existing.find(
            (c) => c.members.indexOf(member._id.toString()) !== -1
        );

        if (!mc && (!member.doorOpen || member.isKnockRequired) && !knock) {
            res.dirty = false;
            await registerKnock({
                user,
                member: member._id,
                team
            });
            res.end();
            return;
        }

        await unmuteUser(user);
        if (uc && !mc) {
            debug('found existing user conversation');
            req.params.conversationId = uc._id;
            await unmuteUser(member);
            return await addUserToConversation(req, res);
        }
        if (!uc && mc && !mc.private) {
            debug('found existing member conversation');
            req.params.conversationId = mc._id;
            return await joinConversation(req, res);
        }
        if (uc && mc && uc._id !== mc._id) return res.end();
        if (mc && mc.private) return res.end();

        await unmuteUser(member);
    }

    const conversation = await new Conversation({
        members,
        team,
        isBroadcast
    }).save();

    await restoreWindow(user, conversation.members);

    res.json(conversation);
    if (knock) {
        await knock.delete();
    }
};

const joinConversation = async (req, res) => {
    const { user } = req;
    const { conversationId } = req.params;

    const conversation = await Conversation.findByIdAndUpdate(
        conversationId,
        {
            $addToSet: { members: user._id },
            $set: { isBroadcast: false }
        },
        { new: true }
    );

    await restoreWindow(user, conversation.members);
    res.json(conversation);
};

const addUserToConversation = async (req, res) => {
    const { user } = req;
    const { conversationId } = req.params;
    const { targetUser } = req.body;

    const conversation = await Conversation.updateOne(
        { _id: conversationId },
        {
            $addToSet: { members: targetUser },
            $set: { isBroadcast: false }
        }
    );

    await restoreWindow(user, conversation.members);
    res.json(conversation);
};

const userConversationPrivate = async (req, res) => {
    const { _id: user, team } = req.user;

    const uc = await Conversation.findOne({
        members: { $in: [user] },
        team
    }).populate('members appVersion');

    for (let member of uc.members) {
        if (!member.appVersion) {
            res.dirty = false;
            produce({
                code: team.code,
                event: 'private-conversation-warning',
                data: { user }
            });
            return res.end();
        }
    }

    uc.set('private', true);
    await uc.save();
    res.json(uc);
};

const leaveConversation = async (req, res) => {
    const { user } = req;
    const { conversationId } = req.params;

    const conversation = await Conversation.findByIdAndUpdate(
        conversationId,
        {
            $pull: { members: user._id }
        },
        { new: true }
    );

    //await produceConversationChange(user.team);
    res.json(conversation);
};

const removeUserFromConversation = async (req, res) => {
    try {
        const { user } = req;
        const { conversationId } = req.params;
        const { memberId } = req.body;

        const isConversationValid = await Conversation.findOne({
            _id: conversationId
        });

        if (isConversationValid && isConversationValid.members.length > 2) {
            await Conversation.findByIdAndUpdate(
                conversationId,
                {
                    $pull: { members: memberId }
                },
                { new: true }
            );
            await minimizeWindow(user, [memberId]);
        }
        res.send('OK');
    } catch (error) {
        return res.status(400).json({
            error: 'something_went_wrong',
            message: error.message
        });
    }
};

const userLeaveConversations = async (req, res) => {
    const { user } = req;
    const team = req.body && req.body.team ? req.body.team : user.team;

    const conversation = await Conversation.find({ team });
    const selected = conversation.find((conv) =>
        conv.members.includes(user._id)
    );

    await Conversation.updateMany({ team }, { $pull: { members: user._id } });

    req.params.state = 'unmute';

    if (selected) {
        if (selected.members.length > 2) {
            await minimizeWindow(user, [user._id]);
        } else {
            await minimizeWindow(user, selected.members);
        }
    }

    await updateMutedState(req, res);
};

const deleteConversation = async (req, res) => {
    const { user } = req;
    const { conversationId } = req.params;

    await Conversation.findByIdAndDelete(conversationId);

    //await produceConversationChange(user.team);
    res.json({ deleted: conversationId });
};

const handleAcceptKnock = (req, res) => {
    acceptKnock(req, res);
};

const handleDeclineKnock = (req, res) => {
    declineKnock(req, res);
    res.json({ success: true });
};

module.exports = {
    produceConversationChange,
    getConversationsByTeam,
    createConversation,
    joinConversation,
    leaveConversation,
    deleteConversation,
    addUserToConversation,
    userLeaveConversations,
    userConversationPrivate,
    leaveConversations,
    acceptKnock: handleAcceptKnock,
    declineKnock: handleDeclineKnock,
    removeUserFromConversation
};
