import React, { useState } from 'react';
import loadable from '@loadable/component';

const Button = loadable(() =>
    import(/* webpackChunkName: "mdl-Button" */ '@material-ui/core/Button')
);
const InputLabel = loadable(() =>
    import(
        /* webpackChunkName: "mdl-InputLabel" */ '@material-ui/core/InputLabel'
    )
);
const MenuItem = loadable(() =>
    import(/* webpackChunkName: "mdl-MenuItem" */ '@material-ui/core/MenuItem')
);
const Select = loadable(() =>
    import(/* webpackChunkName: "mdl-Select" */ '@material-ui/core/Select')
);

import { useAppState } from '../../hooks/useAppState';
import { useTeamMembers } from '../../hooks/useTeamMembers';
import {
    START_CONVERSATION_EVENT,
    END_CONVERSATION_EVENT,
    KNOCK_RECEIVED
} from '../../../shared/constants';

import ipcRenderer from '../../lib/ipcRenderer';

const ConversationControls = () => {
    const [appState] = useAppState();
    const teamMembers = useTeamMembers();
    const [selectedAction, setSelectedAction] = useState('startConversation');
    const [selectedUser, setSelectedUser] = useState(null);

    const handleSelectAction = (e) => {
        setSelectedAction(e.target.value);
    };

    const handleSelectUser = (e) => {
        setSelectedUser(e.target.value);
    };

    const handleStartConversation = () => {
        ipcRenderer.invoke(START_CONVERSATION_EVENT, selectedUser);
    };

    const handleEndConversation = () => {
        const activeConversation = appState.conversations.find(
            (c) =>
                c.members.includes(appState.user._id) &&
                c.members.includes(selectedUser)
        );

        if (activeConversation) {
            ipcRenderer.invoke(END_CONVERSATION_EVENT, activeConversation._id);
        }
    };

    const handleReceiveKnock = () => {
        ipcRenderer.invoke(KNOCK_RECEIVED, {
            user: appState.user._id,
            knocker: selectedUser
        });
    };

    const actions = {
        startConversation: {
            handler: handleStartConversation,
            displayName: 'Start Conversation'
        },
        endConversation: {
            handler: handleEndConversation,
            displayName: 'End Conversation'
        },
        receiveKnock: {
            handler: handleReceiveKnock,
            displayName: 'Receive Knock'
        }
    };

    const execAction = () => {
        actions[selectedAction].handler();
    };

    return (
        <div className="o-form__field">
            <span className="o-form__title">Conversation Controls</span>
            <div className="o-flex--align-items-end">
                <div>
                    <InputLabel id="selectActionLabel">Action</InputLabel>
                    <Select
                        className="o-form__select"
                        labelId="selectActionLabel"
                        id="selectAction"
                        value={selectedAction || ''}
                        onChange={handleSelectAction}
                    >
                        {Object.entries(actions).map(([key, value]) => (
                            <MenuItem key={key} value={key}>
                                {value.displayName}
                            </MenuItem>
                        ))}
                    </Select>
                </div>

                <div>
                    <InputLabel id="selectActionLabel">User</InputLabel>
                    <Select
                        className="o-form__select"
                        labelId="selectUserLabel"
                        id="selectUser"
                        value={selectedUser || ''}
                        onChange={handleSelectUser}
                    >
                        {teamMembers.map((tm) => (
                            <MenuItem key={tm._id} value={tm._id}>
                                {tm.nickname}
                            </MenuItem>
                        ))}
                    </Select>
                </div>

                <Button
                    className="mdl-button mdl-button--raised mdl-button--colored"
                    onClick={execAction}
                >
                    Connect
                </Button>
            </div>
        </div>
    );
};

export default ConversationControls;
