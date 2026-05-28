/* global config */
import React, { useEffect, useReducer, createContext } from 'react';
import propTypes from 'prop-types';

import { triggerConversationUpdate } from '../../requests';
import {
    UPDATE_TRAY_TEAM,
    START_POWER_SAVE_BLOCKER,
    STOP_POWER_SAVE_BLOCKER,
    UPDATE_TEAM_PROP,
    RESTART
} from '../../../shared/constants';

import { ProfileProvider } from '../ProfileContext';
import { useAppState } from '../../hooks/useAppState';
import { isArray } from '../../utilities/isArray';
import ipcRenderer from '../../lib/ipcRenderer';
import sseHandlers from './sseHandlers';

const { apiBaseURL } = config;
const endpoint = `${apiBaseURL}/team-service`;

export const TeamServiceContext = createContext(null);

function teamServiceReducer(state, action) {
    switch (action.type) {
        case 'user-list':
            return {
                ...state,
                team: action.payload
            };
        case 'door-state':
            return {
                ...state,
                team: {
                    ...state.team,
                    [action.payload._id]: action.payload
                }
            };
        case 'muted-state':
            return {
                ...state,
                team: {
                    ...state.team,
                    [action.payload._id]: action.payload
                }
            };
        case 'conversation-change':
            return {
                ...state,
                conversations: action.payload.conversations
            };
        case 'sse':
            return {
                ...state,
                sse: action.payload
            };
        case 'profile-update':
            return {
                ...state,
                team: {
                    ...state.team,
                    [action.payload._id]: action.payload
                }
            };
        default:
            return state;
    }
}

export const TeamServiceProvider = ({ children }) => {
    const [appState, setAppState] = useAppState();

    const [state, dispatch] = useReducer(teamServiceReducer, {
        sse: null,
        team: null,
        profile: null,
        conversations: []
    });

    useEffect(() => {
        const sse = new EventSource(endpoint);
        const eventListenerPairs = [];
        const registerListeners = (config) => {
            for (let i in config) {
                sse.addEventListener(i, config[i]);
                eventListenerPairs.push([i, config[i]]);
            }
        };

        const onMessage = ({ type, data }) => {
            const payload = JSON.parse(data);
            dispatch({ type, payload });
        };

        const updateAppStateProfileOnMessage = ({ type, data }) => {
            onMessage({ type, data });
            const payload = data ? JSON.parse(data) : null;
            if (payload._id === appState.user._id) {
                setAppState({ user: payload });
            }
        };

        const updateTeamProp = ({ type, data }) => {
            onMessage({ type, data });
            const payload = data ? JSON.parse(data) : null;
            ipcRenderer.invoke(UPDATE_TEAM_PROP, payload);
        };

        const updateTeamMembers = ({ type, data }) => {
            onMessage({ type, data });
            const payload = data ? JSON.parse(data) : null;

            const isUserRemoved = !payload[appState.user._id];
            isUserRemoved
                ? ipcRenderer.invoke(RESTART, appState.user.team)
                : ipcRenderer.invoke(UPDATE_TRAY_TEAM, payload);
        };

        const handleTriggerMinimize = ({ data }) => {
            const payload = JSON.parse(data);
            const { membersIds, status } = payload;

            if (isArray(membersIds) && membersIds.includes(appState.user._id)) {
                sseHandlers.onMinimizeWindow(status);
            }
        };

        const handleConversationChange = ({ type, data }) => {
            const payload = JSON.parse(data);
            const isParticipating = payload.conversations.find(
                (c) => c.members.indexOf(appState.user._id) !== -1
            );

            const powerSaveBlockerEvent = isParticipating
                ? START_POWER_SAVE_BLOCKER
                : STOP_POWER_SAVE_BLOCKER;

            ipcRenderer.invoke(powerSaveBlockerEvent);

            onMessage({ type, data });
        };

        registerListeners({
            'profile-update': updateAppStateProfileOnMessage,
            'user-list': updateTeamMembers,
            'update-team-prop': updateTeamProp,
            'door-state': updateAppStateProfileOnMessage,
            'muted-state': updateAppStateProfileOnMessage,
            'minimize-state': handleTriggerMinimize,
            'conversation-change': handleConversationChange,
            'toggle-member-online': sseHandlers.onToggleMemberOnline,
            'member-knock-start': sseHandlers.onMemberKnockStart,
            'user-knock-start': sseHandlers.onUserKnockStart,
            'knock-expired': sseHandlers.onKnockExpired,
            'knock-declined': sseHandlers.onKnockDeclined,
            'knock-accepted': sseHandlers.onKnockAccepted,
            'device-conflict': sseHandlers.multiDeviceReceived,
            'private-conversation-warning':
                sseHandlers.onPrivateConversationWarning,
            'open': () => setTimeout(triggerConversationUpdate, 150)
        });

        dispatch({ type: 'sse', payload: sse });

        return () => {
            eventListenerPairs.forEach(([event, cb]) => {
                sse.removeEventListener(event, cb);
            });
            sse.close();

            dispatch({ type: 'sse', payload: null });
        };
    }, []);

    return (
        <TeamServiceContext.Provider value={state}>
            <ProfileProvider>{children}</ProfileProvider>
        </TeamServiceContext.Provider>
    );
};

TeamServiceProvider.propTypes = {
    children: propTypes.node
};
