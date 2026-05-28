const { MemoryStore } = require('../MemoryStore');

jest.mock('fs', () => ({
    ...jest.createMockFromModule('fs'),
    promises: {
        writeFile: jest.fn().mockResolvedValue(),
        readFile: jest.fn().mockResolvedValue()
    }
}));
jest.mock('path');
jest.mock('config', () => ({
    get: jest.fn(() => ({})),
    app: {
        auth: {
            username: 'johnny'
        }
    }
}));

const mockWindow1 = {
    webContents: {
        send: jest.fn()
    },
    isDestroyed: jest.fn()
};

const mockWindow2 = {
    webContents: {
        send: jest.fn()
    },
    isDestroyed: jest.fn()
};

describe('MemoryStore', () => {
    test('MemoryStore initializes with initialState', () => {
        const mockInitialState = {
            hello: 'world'
        };

        const testStore = new MemoryStore(mockInitialState);

        expect(testStore.state.hello).toBe(mockInitialState.hello);
    });
    test('get returns expected value', () => {
        const mockInitialState = {
            hello: 'world'
        };

        const testStore = new MemoryStore(mockInitialState);

        expect(testStore.get('hello')).toBe(mockInitialState.hello);
    });
    test('get supports dot notation', () => {
        const mockInitialState = {
            foo: {
                bar: 'baz'
            }
        };

        const testStore = new MemoryStore(mockInitialState);

        expect(testStore.get('foo.bar')).toBe(mockInitialState.foo.bar);
    });
    test('setState updates the state without overwriting existing values', () => {
        const mockInitialState = {
            hello: 'world'
        };

        const updates = {
            name: 'dylan'
        };

        const testStore = new MemoryStore(mockInitialState);

        testStore.setState(updates);

        expect(testStore.get('hello')).toBe(mockInitialState.hello);
        expect(testStore.get('name')).toBe(updates.name);
    });
    test('setState sends updates to all subscribed windows', () => {
        const testStore = new MemoryStore();

        testStore.subscribe(mockWindow1, mockWindow2);

        testStore.setState({ online: true });

        expect(mockWindow1.webContents.send).toHaveBeenCalled();
        expect(mockWindow2.webContents.send).toHaveBeenCalled();
    });
    test('subscribe adds window to subscribed windows', () => {
        const testStore = new MemoryStore();

        testStore.subscribe(mockWindow1);

        expect(testStore.subscribedWindows).toContain(mockWindow1);
    });
    test('unsubscribe removes window from subscribed windows', () => {
        const testStore = new MemoryStore();

        testStore.subscribe(mockWindow1);

        expect(testStore.subscribedWindows).toContain(mockWindow1);

        testStore.unsubscribe(mockWindow1);

        expect(testStore.subscribedWindows).not.toContain(mockWindow1);
    });
    /* test('exported appStore is instance of MemoryStore', () => {
        expect(appStore).toBeInstanceOf(MemoryStore);
    });*/
});
