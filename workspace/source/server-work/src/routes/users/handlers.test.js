const mongoose = require('mongoose');

const MockRes = require('../../lib/MockRes');
const {
    getProfile,
    getTeam,
    updateDoorState,
    updateProfile,
    searchUsers
} = require('./handlers');
const User = require('../../models/User');
const Team = require('../../models/Team');
const { AppError } = require('../../lib/error');

const mockId1 = '5ebcbe2330ad55e18d7eb6de';
const mockId2 = '5ebcbe4879a27bdf2d1e418c';
let res;
let existingUser;
let team;

jest.mock('../../lib/error', () => {
    return {
        AppError: jest.fn()
    };
});

jest.mock('../../lib/kafka', () => {
    return {
        consumer: {
            connect: jest.fn(),
            run: jest.fn()
        },
        produce: jest.fn()
    };
});

describe('Users route handlers', () => {
    beforeAll(async () => {
        await mongoose.connect(process.env.MONGO_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            useFindAndModify: false,
            useCreateIndex: true
        });
        existingUser = await new User({
            nickname: 'Test User',
            email: 'test@touchto.io'
        }).save();
        team = await new Team({
            code: 'test',
            name: 'test',
            members: [existingUser._id]
        }).save();
        existingUser.set('team', team._id);
        await existingUser.save();
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

    test('getProfile sends user', () => {
        const req = {
            user: {
                nickname: 'User'
            }
        };

        getProfile(req, res);

        expect(res.sent).toBe(req.user);
    });

    test('getTeam sends user team', async () => {
        const req = {
            user: existingUser
        };

        await getTeam(req, res);
        expect(res.sent.name).toBe(team.name);
    });

    test('door closes', async () => {
        const req = {
            user: existingUser,
            params: {
                state: 'close'
            }
        };

        await updateDoorState(req, res);
        expect(res.end).toBe('OK');
    });
    test('door opens', async () => {
        const req = {
            user: existingUser,
            params: {
                state: 'open'
            }
        };

        await updateDoorState(req, res);
        expect(res.end).toBe('OK');
    });
    test('door ignores sames state', async () => {
        const req = {
            user: existingUser,
            params: {
                state: 'open'
            }
        };

        await updateDoorState(req, res);
        expect(res.end).toBe('OK');
    });
    test('updateProfile updates user', async () => {
        const req = {
            user: {
                _id: existingUser._id
            },
            body: {
                nickname: 'Johnny'
            }
        };

        await updateProfile(req, res);

        expect(res.sent.nickname).toBe('Johnny');
    });

    test('searchUser returns list of users by nickname', async () => {
        const nicknames = ['Tony', 'Tom', 'Aaron'];

        await Promise.all(
            nicknames.map((nickname) =>
                new User({
                    nickname,
                    orgCompany: 'Touch To'
                }).save()
            )
        );

        const req = {
            user: {
                orgCompany: 'Touch To'
            },
            params: { searchString: 'to' }
        };

        await searchUsers(req, res);

        expect(!!res.sent.find((u) => u.nickname === 'Tony')).toBe(true);
        expect(!!res.sent.find((u) => u.nickname === 'Tom')).toBe(true);
        expect(!!res.sent.find((u) => u.nickname === 'Aaron')).not.toBe(true);
    });
    test('searchUser only returns users in the same org', async () => {
        await new User({
            nickname: 'Elon Musk',
            orgCompany: 'Tesla'
        });

        const req = {
            user: {
                orgCompany: 'Touch To'
            },
            params: { searchString: 'elon' }
        };

        await searchUsers(req, res);

        expect(!!res.sent.find((u) => u.nickname === 'Elon Musk')).toBe(false);
    });
    test('searchUser allows search by email', async () => {
        const emails = [
            'admin@touchto.io',
            'adam@touchto.io',
            'dylan@touchto.io'
        ];

        await Promise.all(
            emails.map((email) =>
                new User({
                    email,
                    orgCompany: 'Touch To'
                }).save()
            )
        );

        const req = {
            user: {
                orgCompany: 'Touch To'
            },
            params: { searchString: 'ad' }
        };

        await searchUsers(req, res);

        expect(!!res.sent.find((u) => u.email === 'admin@touchto.io')).toBe(
            true
        );
        expect(!!res.sent.find((u) => u.email === 'adam@touchto.io')).toBe(
            true
        );
        expect(!!res.sent.find((u) => u.email === 'dylan@touchto.io')).toBe(
            false
        );
    });
    test('searchUser allows search by department', async () => {
        const departments = ['engineering', 'legal', 'design', 'devops'];

        await Promise.all(
            departments.map((department) =>
                new User({
                    department,
                    orgCompany: 'Touch To'
                }).save()
            )
        );

        const req = {
            user: {
                orgCompany: 'Touch To'
            },
            params: { searchString: 'de' }
        };

        await searchUsers(req, res);

        expect(!!res.sent.find((u) => u.department === 'design')).toBe(true);
        expect(!!res.sent.find((u) => u.department === 'devops')).toBe(true);
        expect(!!res.sent.find((u) => u.department === 'legal')).toBe(false);
    });
});
