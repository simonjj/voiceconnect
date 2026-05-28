const MockRes = require('./MockRes');

let res;

describe('MockRes', () => {
    beforeEach(() => {
        res = new MockRes();
    });
    afterEach(() => {
        res = null;
    });
    test('send sets sent value', () => {
        const data = { foo: 'bar' };

        res.send(data);

        expect(res.sent).toBe(data);
    });
    test('end sets end value', () => {
        const data = 'OK';

        res.end(data);

        expect(res.end).toBe(data);
    });
    test('send returns instance', () => {
        expect(res.send('foo')).toBe(res);
    });
    test('set sets any values given in object arg', () => {
        const values = {
            'Content-Type': 'application/json',
            'Connection': 'keep-alive'
        };

        res.set(values);

        expect(res['Content-Type']).toBe(values['Content-Type']);
        expect(res['Connection']).toBe(values['Connection']);
    });
    test('set returns instance', () => {
        expect(res.set({})).toBe(res);
    });
    test('status sets sentStatus to given code arg', () => {
        const code = 200;
        res.status(code);

        expect(res.sentStatus).toBe(code);
    });
    test('status returns instance', () => {
        expect(res.status(404)).toBe(res);
    });
    test('json sets sent value', () => {
        const obj = { foo: 'bar' };

        res.json(obj);

        expect(res.sent).toBe(obj);
    });
});
