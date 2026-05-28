import { useEffect, useState } from 'react';
import { useAppState } from './useAppState';

export const useConversationUtils = (teamMemberId) => {
    const [{ user, conversations }] = useAppState();

    const activeConversation = conversations.find((c) =>
        c.members.includes(teamMemberId)
    );

    const conversationStates = {
        NO_CONVERSATION: 'NO_CONVERSATION',
        IN_JOINABLE_CONVERSATION: 'IN_JOINABLE_CONVERSATION',
        IN_SEPARATE_CONVERSATION: 'IN_SEPARATE_CONVERSATION',
        IN_SAME_CONVERSATION: 'IN_SAME_CONVERSATION'
    };

    const userConversation = conversations.find((c) =>
        c.members.includes(user._id)
    );

    const [conversationState, setConversationState] = useState(
        getConversationState()
    );
    useEffect(() => {
        setConversationState(getConversationState());
    }, [conversations]);

    function getConversationState() {
        if (!activeConversation) return conversationStates.NO_CONVERSATION;
        if (activeConversation.members.includes(user._id)) {
            return conversationStates.IN_SAME_CONVERSATION;
        }
        if (userConversation) {
            return conversationStates.IN_SEPARATE_CONVERSATION;
        } else {
            return conversationStates.IN_JOINABLE_CONVERSATION;
        }
    }

    return {
        activeConversation,
        conversationStates,
        conversationState,
        userConversation
    };
};
