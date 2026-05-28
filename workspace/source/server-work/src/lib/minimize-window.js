const User = require('../models/User');
const { produce } = require('./kafka');

async function toggleMinimize(userId, payload) {
    const user = await User.findById(userId).populate('team', 'code');

    if (user.team) {
        const { code } = user.team;
        produce({
            code,
            event: 'minimize-state',
            data: payload
        });
    }
}

async function minimizeWindow(userId, membersIds) {
    await toggleMinimize(userId, { status: false, membersIds });
}

async function restoreWindow(userId, membersIds) {
    await toggleMinimize(userId, { status: true, membersIds });
}

module.exports = {
    minimizeWindow,
    restoreWindow
};
