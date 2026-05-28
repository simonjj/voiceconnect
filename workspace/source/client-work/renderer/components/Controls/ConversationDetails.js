import React from 'react';

import { useAppState } from '../../hooks/useAppState';

const ConversationDetails = () => {
    const [appState] = useAppState();
    const { conversations } = appState;
    const nicknameFromId = (id) => {
        if (id === appState.user._id) {
            return appState.user.nickname;
        }

        const tm = appState.team.members.find((tm) => tm._id === id);

        return tm ? tm.nickname : 'Unknown User';
    };

    return (
        <details className="o-form__field">
            <summary className="o-form__title">Active Conversations</summary>
            {conversations.length ? (
                <table className="mdl-data-table mdl-js-data-table mdl-data-table--selectable mdl-shadow--2dp">
                    <thead>
                        <tr>
                            <th className="mdl-data-table__cell--non-numeric">
                                Code
                            </th>
                            <th className="mdl-data-table__cell--non-numeric">
                                ID
                            </th>
                            <th className="mdl-data-table__cell--non-numeric">
                                Members
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {conversations.map((c) => (
                            <tr key={c._id}>
                                <td className="mdl-data-table__cell--non-numeric">
                                    {c.code}
                                </td>
                                <td className="mdl-data-table__cell--non-numeric">
                                    {c._id}
                                </td>
                                <td className="mdl-data-table__cell--non-numeric">
                                    {c.members.map((m) => (
                                        <p key={m}>{nicknameFromId(m)}</p>
                                    ))}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <p>No active conversations</p>
            )}
        </details>
    );
};

export default ConversationDetails;
