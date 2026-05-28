const debug = require('debug')('ttc:team-service');

const { EOL } = require('os');

const teams = new Map();
const Team = require('../models/Team');
const Conversation = require('../models/Conversation');

const { produce, consumer } = require('./kafka');

let lastID = 0;

const sendUpdatedTeamProp = async (code, payload) => {
    await produce({
        code,
        event: 'update-team-prop',
        data: payload
    });
};

const sendMemberList = async (code) => {
    const team = await Team.findOne({ code })
        .populate(
            'members',
            'email doorOpen muted online initials code lastLogin avatarColor firstName lastName'
        )
        .select('members');

    const isTeamExist = team && team.members && team.members.length;
    const formattedTeam = isTeamExist
        ? Object.fromEntries(team.members.map((m) => [m._id, m]))
        : {};

    produce({
        code,
        event: 'user-list',
        data: formattedTeam
    });
};

const sendConversations = async (team, code) => {
    const conversations = await Conversation.find({ team });

    await produce({
        code,
        event: 'conversation-change',
        data: { conversations }
    });
};

const middleware = async (req, res) => {
    const {
        id,
        user,
        team: { _id: teamID, code }
    } = req;

    if (!teams.has(code)) teams.set(code, new Map());
    const team = teams.get(code);

    res.__heartbeat = () => {
        clearTimeout(res.__heartbeat.timer);
        try {
            if (!res.finished) res.write(`:${EOL}`);
        } catch (err) {}
        res.__heartbeat.timer = setTimeout(res.__heartbeat, 5000);
    };
    res.__heartbeat();

    req.on('close', async () => {
        team.delete(id);
        clearTimeout(res.__heartbeat.timer);

        if (res.silent) return;

        user.set('online', false);

        await user.save();

        produce({
            code,
            event: 'toggle-member-online',
            data: null
        });

        sendMemberList(code);
    });

    //Register ServerResponse with team
    team.set(res.silent ? id : user.id, res);
    if (!res.silent) {
        sendMemberList(code);
    }
};
const send = (res, event, message) => {
    clearTimeout(res.__heartbeat.timer);
    let data = '';
    if (event && event === 'heartbeat') {
        data += `:${EOL}`;
    } else {
        data += `id:${lastID}${EOL}`;
        data += `event: ${event}${EOL}`;
        if (message) {
            data += `data: ${message
                .split(/${EOL}/)
                .join(`${EOL}data: `)}${EOL}`;
        }
    }
    data += EOL;
    lastID++;

    res.write(data);
    res.__heartbeat();
};
const broadcast = ({ code, event, data }) => {
    if (!code) return;
    const message = JSON.stringify(data);

    const team = teams.get(code);

    const allowedSelfEvents = ['instance-chosen', 'instance-quit'];

    if (team) {
        for (let res of team.values()) {
            try {
                if (
                    data.src &&
                    res.req.user._id.toString() === data.src &&
                    !allowedSelfEvents.includes(event)
                ) {
                    continue;
                }
                if (data.user && res.req.user._id.toString() === data.user) {
                    send(res, event, message);
                } else if (!data.user) send(res, event, message);
            } catch (err) {
                send(res, event, message);
            }
        }
    }
};

const TeamService = async () => {
    await consumer.run({
        eachMessage: async ({ message }) => {
            /* istanbul ignore next */
            try {
                const payload = JSON.parse(message.value.toString());
                if (payload.event === 'user-offline') {
                    const { code } = payload;
                    const team = teams.get(code);
                    if (team && team.has(payload.data)) {
                        const user = team.get(payload.data);
                        team.delete(payload.data);
                        user.end();
                        sendMemberList(code);
                    }
                } else broadcast(payload);
            } catch (err) {
                console.error(err);
            }
        }
    });
    return middleware;
};

module.exports = TeamService;
module.exports.sendMemberList = sendMemberList;
module.exports.sendUpdatedTeamProp = sendUpdatedTeamProp;
