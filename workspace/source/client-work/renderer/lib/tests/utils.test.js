import { placeholderFn, testId } from '../utils';

describe('utils', () => {
    test('placeholderFn returns nothing, regardless of args given', () => {
        [[], [1, 2, 3, 4], ['foo', 'bar'], [{}]].forEach((args) =>
            expect(placeholderFn(...args)).toBeUndefined()
        );
    });
    test('testId returns argument with data-testid= appended', () => {
        const id = 'container';

        expect(testId(id)).toBe(`[data-testid='${id}']`);
    });
});
