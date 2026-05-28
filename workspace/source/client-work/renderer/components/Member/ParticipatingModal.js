import React from 'react';
import VolumeControl from '../VoiceConnectControls/VolumeControl';
import ConversationControl from '../VoiceConnectControls/ConversationControl';
import useConversations from '../../hooks/useConversations';

export const ParticipatingModal = ({
    isParticipating,
    member,
    user,
    conversations
}) => {
    const { isParticipating: userParticipating } = useConversations(user);

    if (
        userParticipating &&
        isParticipating &&
        userParticipating.code === isParticipating.code
    ) {
        return (
            <VolumeControl
                member={member}
                user={user}
                conversations={conversations}
            />
        );
    }

    if (!userParticipating && isParticipating) {
        return <ConversationControl member={member} />;
    }

    return null;
};
