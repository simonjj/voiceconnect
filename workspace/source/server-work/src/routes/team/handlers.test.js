const mongoose = require('mongoose');

const MockRes = require('../../lib/MockRes');
const { teams, create, join, leave } = require('./handlers');

const User = require('../../models/User');
const Team = require('../../models/Team');
const { AppError } = require('../../lib/error');

let res;
let team;
let user;

jest.mock('../../lib/error', () => {
    return {
        AppError: jest.fn()
    };
});
jest.mock('../../lib/kafka', () => ({
    produce: jest.fn()
}));

describe('Teams route handlers', () => {
    beforeAll(async () => {
        await mongoose.connect(process.env.MONGO_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            useFindAndModify: false,
            useCreateIndex: true
        });
        user = await new User({
            nickname: 'joe',
            email: 'test@touchto.io'
        }).save();
        team = await new Team({
            name: 'Test Team'
        }).save();
    });

    afterAll(async () => {
        mongoose.connection.close();
    });

    beforeEach(() => {
        res = new MockRes();
        AppError.mockClear();
    });
    afterEach(() => {
        res = null;
    });

    test('teams sends teams', async () => {
        const req = { user };
        await teams(req, res);

        expect(JSON.stringify(res.sent)).toContain(team._id);
    });
    test('creates a team', async () => {
        const req = {
            user,
            body: {
                name: 'Test 2'
            }
        };

        await create(req, res);

        expect(res.sent.name).toBe('Test 2');
    });
    test('joins a team', async () => {
        const req = { user, params: { code: team.code } };

        await join(req, res);

        expect(res.sent).toBe('OK');
    });
    test('leaves a team', async () => {
        const req = { user, params: { code: team.code } };

        await leave(req, res);

        expect(res.sent).toBe('OK');
    });
});
