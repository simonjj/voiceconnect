const User = require('../models/User');
const { produce } = require('./kafka');

async function toggleMute(userId, muted) {
    const user = await User.findById(userId).populate('team', 'code');
    user.set('muted', muted);

    await user.save();
    const data = {
        _id: user.id,
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        defaultInitials: user.defaultInitials,
        avatarColor: user.avatarColor,
        firstVisit: user.firstVisit,
        doorOpen: user.doorOpen,
        muted: user.muted,
        online: user.online,
        initials: user.initials,
        code: user.code,
        lastLogin: user.lastLogin,
        isKnockRequired: user.isKnockRequired
    };

    if (user.team) {
        const { code } = user.team;
        produce({
            code,
            event: 'muted-state',
            data
        });
    }
}

async function muteUser(userId) {
    await toggleMute(userId, true);
}

async function unmuteUser(userId) {
    await toggleMute(userId, false);
}

module.exports = {
    muteUser,
    unmuteUser
};
