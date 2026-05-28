const TeamService = require('./TeamService');
const EventEmitter = require('events').EventEmitter;

jest.useFakeTimers();
jest.setTimeout(6000);

jest.mock('./kafka', () => {
    return {
        consumer: {
            connect: jest.fn(),
            run: jest.fn()
        },
        produce: jest.fn()
    };
});

let teamservice;

describe('TeamService', () => {
    beforeAll(async () => {
        teamservice = await TeamService();
    });
    test('connecting', async (done) => {
        const req = new EventEmitter();
        req.user = {
            email: 'tester@touchto.io',
            set: jest.fn(),
            save: jest.fn()
        };
        req.team = {
            code: 'test'
        };

        let res = {
            write: jest.fn((d, cb) => cb())
        };

        await teamservice(req, res);
        expect(res.write).toHaveBeenCalled();

        setTimeout(() => {
            req.emit('close');
            done();
        }, 5500);
        jest.runOnlyPendingTimers();

        const req2 = new EventEmitter();
        req2.user = {
            email: 'test2@touchto.io',
            set: jest.fn(),
            save: jest.fn()
        };
        req2.team = {
            code: 'test'
        };

        await teamservice(req2, res);

        setTimeout(() => {
            req2.emit('close');
            done();
        }, 5500);
        jest.runOnlyPendingTimers();

        expect(res.write).toHaveBeenCalled();
    });
});
