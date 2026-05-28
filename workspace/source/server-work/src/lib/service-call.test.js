const serviceCall = require('./service-call');

describe('API Request check', () => {
    test('it marks an API request', () => {
        const req = {
            xhr: true,
            headers: {
                accept: 'application/json'
            }
        };
        const next = jest.fn();

        const handler = serviceCall.isServiceCall();
        handler(req, null, next);

        expect(req.isServiceCall).toBe(true);
        next.mockClear();
        delete req.isServiceCall;
        delete req.xhr;

        handler(req, null, next);
        expect(req.isServiceCall).toBe(true);
        next.mockClear();
    });
    test('it does not mark a non-json request', () => {
        const req = {
            headers: {
                accept: '*/*,text/html,application/xhtml+xml'
            }
        };
        const next = jest.fn();
        const handler = serviceCall.isServiceCall();
        handler(req, null, next);

        expect(req.isServiceCall).toBe(false);
        next.mockClear();
    });
    test('it continues a json request to next middleware', () => {
        const req = {
            isServiceCall: true
        };
        const next = jest.fn();

        const handler = serviceCall.requiresServiceCall()[1];
        handler(req, null, next);

        expect(next).toHaveBeenCalledWith();
        next.mockClear();
    });
    test('it bypasses non-json request to next router', () => {
        const next = jest.fn();

        const handler = serviceCall.requiresServiceCall()[1];
        handler({}, null, next);

        expect(next).toHaveBeenCalledWith('router');
        next.mockClear();
    });
});
