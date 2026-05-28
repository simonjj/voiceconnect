const catchAsync = require('./catchAsync');

describe('catchAsync', () => {
    test('catchAsync returns a function', () => {
        expect(typeof catchAsync(() => {})).toBe('function');
    });
});
