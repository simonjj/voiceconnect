import React, {
    useEffect,
    useContext,
    useReducer,
    createContext,
    useCallback
} from 'react';
import propTypes from 'prop-types';
import { fetchProfile } from '../../requests';

import { TeamServiceContext } from '../TeamServiceContext';
import { useAppState } from '../../hooks/useAppState';

export const ProfileContext = createContext(null);

function profileReducer(state, action) {
    switch (action.type) {
        case 'profile-update':
            return action.payload;
        case 'door-state':
            return {
                ...state,
                doorOpen: action.payload.doorOpen
            };
        case 'muted-state':
            return {
                ...state,
                muted: action.payload.muted
            };
        default:
            return state;
    }
}

export const ProfileProvider = ({ children }) => {
    const [appState] = useAppState();
    const [profile, dispatch] = useReducer(profileReducer, {});
    const { sse } = useContext(TeamServiceContext);

    const initProfile = useCallback(
        async (abortController) => {
            const profile = appState.user;
            if (profile && !abortController.aborted) {
                dispatch({ type: 'profile-update', payload: profile });
            }
        },
        [appState.user]
    );

    useEffect(() => {
        const abortController = new AbortController();
        initProfile(abortController);

        return () => {
            abortController.abort();
        };
    }, [initProfile]);

    useEffect(() => {
        if (!sse) return;
        if (!profile._id) return;
        const onMessage = ({ type, data }) => {
            const payload = JSON.parse(data);
            if (payload._id === profile._id) dispatch({ type, payload });
        };
        sse.addEventListener('door-state', onMessage);
        sse.addEventListener('muted-state', onMessage);
        sse.addEventListener('trigger-tutorial', onMessage);

        return () => {
            sse.removeEventListener('door-state', onMessage);
            sse.removeEventListener('muted-state', onMessage);
            sse.removeEventListener('trigger-tutorial', onMessage);
        };
    }, [sse, profile]);

    return (
        <ProfileContext.Provider value={[profile, dispatch]}>
            {children}
        </ProfileContext.Provider>
    );
};
ProfileProvider.propTypes = {
    children: propTypes.node
};
