import React, { useState, useEffect } from 'react';
import { useAppState } from '../../../hooks/useAppState';
import { useTeamMembers } from '../../../hooks/useTeamMembers';
import useConversations from '../../../hooks/useConversations';

import '../style.scss';
import clx from 'clsx';

const ConversationControl = ({
    member,
    tutorial = false,
    tutorialAction = () => null
}) => {
    const teamMembers = useTeamMembers(true);
    const {
        startConversation,
        isParticipating: conversation
    } = useConversations(member);
    const [
        { mutedConversations, focusedConversation },
        setAppState
    ] = useAppState();
    const { code } = (conversation && conversation) || {};

    const [participants, setParticipants] = useState([]);
    const [listening, setListening] = useState(false);
    const [muted, setMuted] = useState(false);

    useEffect(() => {
        if (tutorial) {
            setParticipants('CO, NN');
        }
        if (conversation) {
            const conversationParticipants = teamMembers
                .filter((tm) => conversation.members.includes(tm._id))
                .map((tm) => tm.initials.toUpperCase())
                .join(', ');

            setParticipants(conversationParticipants);
            setListening(conversation._id === focusedConversation);
        }
    }, [conversation, tutorial]);

    useEffect(() => {
        if (code && mutedConversations.indexOf(code) !== -1) {
            setMuted(true);
        } else setMuted(false);
    }, [code, mutedConversations]);

    const handleListen = () => {
        if (listening) {
            setAppState({ focusedConversation: null });
        } else {
            setAppState({
                focusedConversation: conversation._id,
                mutedConversations: mutedConversations.filter((c) => c !== code)
            });
        }

        setListening(!listening);
    };

    const handleToggleMute = () => {
        if (mutedConversations.indexOf(code) !== -1)
            setAppState({
                mutedConversations: mutedConversations.filter((c) => c !== code)
            });
        else
            setAppState({
                mutedConversations: [...mutedConversations, code]
            });
    };

    const actions =
        tutorial || (conversation && !conversation.private) ? (
            <>
                <a
                    onClick={tutorial ? tutorialAction : startConversation}
                    className="Control__option"
                    data-drag="disabled"
                >
                    Join
                </a>

                <a
                    onClick={tutorial ? tutorialAction : handleToggleMute}
                    className="Control__option"
                    data-drag="disabled"
                >
                    {muted ? 'Unmute' : 'Mute'}
                </a>
            </>
        ) : (
            'Private'
        );

    return (
        <div
            className={clx(
                'Control Control--conversation',
                tutorial && member._id && `${member._id}`
            )}
        >
            <div className="Control__label">{participants}</div>
            <div className="Control__options">{actions}</div>
        </div>
    );
};

export default ConversationControl;
