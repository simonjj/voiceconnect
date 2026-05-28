/* RFE: Prop types should be included for this file, but not 100% sure what the values should be */
/* eslint-disable react/prop-types */
/* istanbul ignore file */
import React, {
    useEffect,
    useState,
    useReducer,
    createContext,
    useCallback
} from 'react';
import propTypes from 'prop-types';

import { APP_STATE_UPDATE } from '../../../shared/constants';
import { makeGetAppState } from '../../lib/appStateHelpers';

function appStateReducer(state, action) {
    switch (action.type) {
        case APP_STATE_UPDATE:
            return {
                ...state,
                ...action.payload
            };
        default:
            return state;
    }
}

export const AppStateContext = createContext(null);

export const AppStateProvider = ({ children, ipcRendererInstance }) => {
    const [state, dispatch] = useReducer(appStateReducer, {
        tutorial: { step: 0 }
    });
    const [initialized, setInitialized] = useState(false);

    const getAppState = makeGetAppState(ipcRendererInstance);

    const initAppState = useCallback(async () => {
        const payload = await getAppState();
        dispatch({ type: APP_STATE_UPDATE, payload });
        setInitialized(true);
    }, []);

    useEffect(() => {
        initAppState();

        const onAppStateUpdate = (_event, payload) => {
            dispatch({ type: APP_STATE_UPDATE, payload });
        };

        ipcRendererInstance.on(APP_STATE_UPDATE, onAppStateUpdate);

        return () => {
            ipcRendererInstance.removeListener(
                APP_STATE_UPDATE,
                onAppStateUpdate
            );
        };
    }, [initAppState]);

    if (!initialized || !state) return null;

    return (
        <AppStateContext.Provider value={state}>
            {children}
        </AppStateContext.Provider>
    );
};

AppStateProvider.propTypes = {
    children: propTypes.node,
    ipcRendererInstance: propTypes.shape({
        invoke: propTypes.func.isRequired,
        on: propTypes.func.isRequired
    }).isRequired
};
