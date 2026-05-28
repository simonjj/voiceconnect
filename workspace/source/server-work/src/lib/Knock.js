const Knock = require('../models/Knock');
const Team = require('../models/Team');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { produce } = require('./kafka');

async function produceDualEvents(event, code, users) {
    const base = { code, event };
    const [user, member] = users;
    const { firstName: userFirstName } = await User.findById(user);
    const { firstName: memberFirstName } = await User.findById(member);
    await Promise.all([
        produce({
            ...base,
            data: {
                src: user,
                user: member,
                firstName: userFirstName,
                knocker: user
            }
        }),
        produce({
            ...base,
            data: {
                src: member,
                user: user,
                firstName: memberFirstName,
                knocker: user
            }
        })
    ]);
}

async function registerKnock({ user, member, team }) {
    const teamObj = await Team.findById(team);
    const { code } = teamObj;
    const k = await new Knock({
        user,
        member,
        team
    }).save();
    const { firstName: userFirstName } = await User.findById(user);
    const { firstName: memberFirstName } = await User.findById(member);
    await Promise.all([
        produce({
            code,
            event: 'member-knock-start',
            data: {
                src: user,
                user: member,
                firstName: userFirstName
            }
        }),
        produce({
            code,
            event: 'user-knock-start',
            data: {
                src: member,
                user,
                firstName: memberFirstName
            }
        })
    ]);
    async function checkActive() {
        const knock = await Knock.findById(k._id);
        return knock && knock.active;
    }
    async function expire() {
        if (await checkActive()) {
            await k.delete();
            await produceDualEvents('knock-expired', code, [user, member]);
        }
    }
    setTimeout(expire, 8000);
    return k;
}

async function acceptKnock(req, res) {
    const { code } = req.user.team;
    const k = await Knock.findOne({ member: req.user._id });
    if (!k) {
        await produce({
            code,
            event: 'knock-expired',
            data: {
                user: req.user
            }
        });
        return;
    }
    k.set('active', false);
    await k.save();

    const { createConversation } = require('../routes/conversations/handlers');

    produceDualEvents('knock-accepted', code, [k.user, k.member]);
    req.body = { targetUser: k.user };
    req.knock = k;
    return await createConversation(req, res);
}

async function declineKnock(req, res) {
    const { code } = req.user.team;
    const k = await Knock.findOne({ member: req.user._id });
    if (!k) {
        await produce({
            code,
            event: 'knock-expired',
            data: {
                user: req.user
            }
        });
        return;
    }
    produceDualEvents('knock-declined', code, [k.user, k.member]);
    k.set('active', false);
    return await k.save();
}

module.exports = {
    registerKnock,
    acceptKnock,
    declineKnock
};
