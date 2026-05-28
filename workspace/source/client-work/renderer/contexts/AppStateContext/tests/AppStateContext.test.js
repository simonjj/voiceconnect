import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import ipcRenderer from '../../../lib/ipcRenderer';
import { AppStateContext, AppStateProvider } from '../';
import { GET_APP_STATE } from '../../../../shared/constants/ipcChannels';

jest.mock(
    '../../../lib/ipcRenderer',
    () => ({
        invoke: jest.fn(),
        on: jest.fn(),
        removeListener: jest.fn()
    }),
    { virtual: true }
);

const mockAppState = {
    hello: 'world'
};

describe('AppStateContext', () => {
    beforeEach(() => {
        ipcRenderer.on.mockClear();
    });
    test('appState is available through context', async () => {
        ipcRenderer.invoke.mockImplementationOnce((event) => {
            if (event === GET_APP_STATE) {
                return Promise.resolve(mockAppState);
            } else return Promise.reject();
        });

        await act(async () => {
            const { getByText } = render(
                <AppStateProvider ipcRendererInstance={ipcRenderer}>
                    <AppStateContext.Consumer>
                        {(appState) => (
                            <div>{`Hello ${appState && appState.hello}`}</div>
                        )}
                    </AppStateContext.Consumer>
                </AppStateProvider>
            );

            await waitFor(() => {
                getByText(`Hello ${mockAppState.hello}`);
            });
        });
    });
    test('ipcRenderer handler is set up in initial useEffect', async () => {
        await act(async () => {
            render(
                <AppStateProvider ipcRendererInstance={ipcRenderer}>
                    {'Hello, there!'}
                </AppStateProvider>,
                container
            );
        });
        expect(ipcRenderer.on).toHaveBeenCalledTimes(1);
    });
});
