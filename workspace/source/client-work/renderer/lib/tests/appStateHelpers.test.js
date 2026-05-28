import { makeGetAppState, makeSetAppState } from '../appStateHelpers';
import { GET_APP_STATE, SET_APP_STATE } from '../../../shared/constants';

jest.mock(
    '../ipcRenderer',
    () => ({
        invoke: jest.fn(),
        on: jest.fn(),
        removeListener: jest.fn()
    }),
    { virtual: true }
);

describe('appStateHelpers', () => {
    test('makeGetAppState returns a function', () => {
        const getAppState = makeGetAppState({ invoke: jest.fn() });

        expect(typeof getAppState).toBe('function');
    });
    test('makeGetAppState returns an async function that returns state', async () => {
        const mockState = {
            message: 'hello'
        };

        const mockIpc = {
            invoke: () => Promise.resolve(mockState)
        };

        const getAppState = makeGetAppState(mockIpc);

        const state = await getAppState();

        expect(state).toBe(mockState);
    });
    test('GET_APP_STATE event is invoked in function returned from makeGetAppState', () => {
        const mockIpc = {
            invoke: jest.fn()
        };

        const getAppState = makeGetAppState(mockIpc);
        getAppState();

        expect(mockIpc.invoke).toHaveBeenCalledWith(GET_APP_STATE);
    });
    test('makeSetAppState returns a function', () => {
        expect(typeof makeSetAppState({ invoke: jest.fn() })).toBe('function');
    });
    test('makeSetAppState returns a function that invokes SET_APP_STATE event with given data', () => {
        const data = {
            budgies: ['Little Mo', 'Pickle']
        };
        const mockIpc = {
            invoke: jest.fn()
        };

        const setAppState = makeSetAppState(mockIpc);

        setAppState(data);

        expect(mockIpc.invoke).toHaveBeenCalledWith(SET_APP_STATE, data);
    });
});
