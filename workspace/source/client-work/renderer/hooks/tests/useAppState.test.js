import React from 'react';

import { AppStateContext } from '../../contexts/AppStateContext';
import { useAppState } from '../useAppState';
import { act, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock(
    '../../lib/ipcRenderer',
    () => ({
        invoke: jest.fn(),
        on: jest.fn(),
        removeListener: jest.fn()
    }),
    { virtual: true }
);

const mockAppState = {
    message: 'hello world'
};
const MockConsumer = () => {
    const [appState] = useAppState();

    return <>{appState && appState.message}</>;
};

describe('useAppState', () => {
    test('useAppState returns values from AppStateContext', async () => {
        await act(async () => {
            const { getByText } = render(
                <AppStateContext.Provider value={mockAppState}>
                    <MockConsumer />
                </AppStateContext.Provider>,
                container
            );

            await waitFor(() => getByText('hello world'));
        });
    });
});
