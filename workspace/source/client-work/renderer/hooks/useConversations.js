import { useCallback, useContext } from 'react';

import { TeamServiceContext } from '../contexts/TeamServiceContext';
import {
    reqLeaveConversation,
    reqPrivateConversation,
    reqStartConversation
} from '../requests';

const useConversations = (member) => {
    const { _id: targetUser } = member || { _id: null };
    const { conversations } = useContext(TeamServiceContext);

    const startConversation = useCallback(
        reqStartConversation.bind(null, { targetUser }),
        []
    );

    const startBroadcast = useCallback(
        reqStartConversation.bind(null, { isBroadcast: true }),
        []
    );

    const leaveConversations = useCallback(reqLeaveConversation, []);

    const makePrivate = useCallback(reqPrivateConversation, []);

    const isParticipating = () => {
        return conversations.find((c) => c.members.indexOf(targetUser) !== -1);
    };

    return {
        conversations,
        startConversation,
        startBroadcast,
        leaveConversations,
        makePrivate,
        isParticipating: isParticipating()
    };
};

export default useConversations;
