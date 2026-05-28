const parseDotNotation = require('../parseDotNotation');

const testObj = {
    foo: {
        bar: {
            baz: 12345
        }
    },
    message: 'hello world'
};

describe('parseDotNotation', () => {
    test('returns value for key', () => {
        expect(parseDotNotation('message', testObj)).toBe(testObj.message);
    });
    test('supports dot notation for nested properties', () => {
        expect(parseDotNotation('foo.bar.baz', testObj)).toBe(
            testObj.foo.bar.baz
        );
    });
    test('returns undefined for keys that are not a property of given object', () => {
        expect(parseDotNotation('value', testObj)).toBe(undefined);
    });
    test('throws an error if trying to access key on non-object', () => {
        expect(() => {
            parseDotNotation('message.foo', testObj);
        }).toThrow('Invalid key: foo in message.foo');
    });
});
