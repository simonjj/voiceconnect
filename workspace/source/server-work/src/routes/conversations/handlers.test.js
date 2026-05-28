const mongoose = require('mongoose');

const MockRes = require('../../lib/MockRes');
const {
    getConversationsByTeam,
    createConversation,
    joinConversation,
    mergeConversations,
    leaveConversation,
    deleteConversation,
    produceConversationChange,
    leaveConversations
} = require('./handlers');
const Conversation = require('../../models/Conversation');
const Team = require('../../models/Team');
const User = require('../../models/User');

jest.mock('../../lib/kafka', () => ({
    produce: jest.fn()
}));

let user;
let teammate;
let res;
let team;

describe('Conversation route handlers', () => {
    beforeAll(async () => {
        await mongoose.connect(process.env.MONGO_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            useFindAndModify: false,
            useCreateIndex: true
        });
        user = await new User({
            nickname: 'test',
            email: 'test@touchto.io'
        }).save();
        teammate = await new User({
            nickname: 'teammate',
            email: 'teammate@touchto.io'
        }).save();
        team = await new Team({
            code: 'testTeam',
            name: 'testTeam',
            members: [user._id]
        }).save();
        user.set('team', team._id);
        teammate.set('team', team._id);
        await user.save();
        await teammate.save();
    });
    afterAll(() => {
        mongoose.connection.close();
    });
    beforeEach(() => {
        res = new MockRes();
    });
    afterEach(() => {
        res = null;
    });
    test('getConversationsByTeam returns all conversations for team', async () => {
        const convo = await new Conversation({
            members: [user._id],
            team: user.team
        }).save();

        const req = { user };

        await getConversationsByTeam(req, res);

        expect(String(res.sent[0]._id)).toBe(String(convo._id));
    });
    test('createConversation creates a conversation with user and target user', async () => {
        const req = {
            user,
            body: {
                targetUser: teammate._id
            }
        };

        await createConversation(req, res);

        const newConvo = res.sent;

        expect(String(newConvo.team)).toBe(String(team._id));
        [user._id, teammate._id].forEach((id) => {
            expect(newConvo.members.includes(id)).toBe(true);
        });
    });
    test('joinConversation adds user to conversation members', async () => {
        const convo = await new Conversation({
            members: [teammate._id],
            team: team._id
        }).save();

        const req = {
            user,
            params: {
                conversationId: convo._id
            }
        };

        await joinConversation(req, res);

        expect(res.sent.members.includes(user._id)).toBe(true);
    });
    test('mergeConversations creates a new conversation with members of both conversations', async () => {
        const teammate2 = await new User({
            nickname: 'teammate2',
            email: 'teammate2@touchto.io',
            team: team._id
        }).save();
        const teammate3 = await new User({
            nickname: 'teammate3',
            email: 'teammate3@touchto.io',
            team: team._id
        }).save();

        const convo1 = await new Conversation({
            team: team._id,
            members: [teammate._id, user._id]
        }).save();
        const convo2 = await new Conversation({
            team: team._id,
            members: [teammate3._id, teammate2._id]
        }).save();

        const req = {
            user,
            body: {
                conversations: [convo1, convo2]
            }
        };

        await mergeConversations(req, res);

        [user._id, teammate._id, teammate2._id, teammate3._id].forEach((id) => {
            expect(res.sent.members.includes(id)).toBe(true);
        });
    });
    test('leaveConversation removes user from conversation', async () => {
        const convo = await new Conversation({
            team: team._id,
            members: [teammate._id, user._id]
        }).save();

        const req = {
            user,
            params: {
                conversationId: convo._id
            }
        };

        await leaveConversation(req, res);

        expect(res.sent.members.includes(user._id)).toBe(false);
    });
    test('deleteConversation removes a conversation', async () => {
        const convo = await new Conversation({
            team: team._id,
            members: [teammate._id, user._id]
        }).save();

        const req = {
            user,
            params: {
                conversationId: convo._id
            }
        };

        expect(await Conversation.findById(convo._id)).not.toBe(null);

        await deleteConversation(req, res);

        expect(await Conversation.findById(convo._id)).toBe(null);
    });
    test('leaveConversations removes user from conversation if there are more than 2 members', async () => {
        const teammate2 = await new User({
            nickname: 'teammate2',
            email: 'teammate2@touchto.io',
            team: team._id
        }).save();
        const teammate3 = await new User({
            nickname: 'teammate3',
            email: 'teammate3@touchto.io',
            team: team._id
        }).save();

        const convo = await new Conversation({
            team: team._id,
            members: [teammate._id, teammate2._id, teammate3._id, user._id]
        }).save();

        await leaveConversations(user._id, team.code);

        const updatedConvo = await Conversation.findById(convo._id);

        expect(updatedConvo.members.includes(user._id)).toBe(false);
    });
    test('leaveConversations deletes conversation if there is only 1 member left after leaving', async () => {
        const convo = await new Conversation({
            team: team._id,
            members: [teammate._id, user._id]
        }).save();

        await leaveConversations(user._id, team.code);

        expect(await Conversation.findById(convo._id)).toBe(null);
    });
});
