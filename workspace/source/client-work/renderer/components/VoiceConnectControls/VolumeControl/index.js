import React, { useMemo } from 'react';
import { useAppState } from '../../../hooks/useAppState';

import '../style.scss';
import { reqDeleteMemberFromConversation } from '../../../requests';
import { isEmpty } from '../../../utilities/isEmpty';

const VolumeControl = ({ member, user, conversations }) => {
    const [appState, setAppState] = useAppState();
    const settings = appState.volumeSettings[member._id];

    const commonConversation = useMemo(() => {
        const conversationTogether = conversations.find((conv) => {
            return (
                conv.members.includes(user.id) &&
                conv.members.includes(member.id)
            );
        });
        if (conversationTogether) {
            return conversationTogether;
        }
        return {};
    }, [conversations, member, user]);

    const isMoreThanTwoMembers = useMemo(() => {
        const currentConversation = conversations.find((conv) =>
            conv.members.includes(user.id)
        );
        if (currentConversation) {
            return currentConversation.members.length > 2;
        }
        return 0;
    }, [conversations, user]);

    const handleDisconnectMember = async () => {
        if (!isEmpty(commonConversation) && member) {
            await reqDeleteMemberFromConversation(
                commonConversation._id,
                member.id
            );
        }
    };

    const changeVolumeSettings = (newVal) => {
        const prevVolumeSettings = appState.volumeSettings || {};
        const prevTeamMemberSettings = prevVolumeSettings[member._id];

        setAppState({
            volumeSettings: {
                ...prevVolumeSettings,
                [member._id]: {
                    ...prevTeamMemberSettings,
                    ...newVal
                }
            }
        });
    };

    const setVolume = (e) => {
        changeVolumeSettings({
            volume: e.target.value * 0.01
        });
    };

    const toggleMute = () => {
        const prevAudioEnabled = settings ? settings.audioEnabled : 1.0;

        changeVolumeSettings({
            audioEnabled: !prevAudioEnabled
        });
    };

    return (
        <div className="Control Control--volume">
            <div className="Control__label">{member.nickname}</div>

            <input
                className="Control__input"
                type="range"
                min="0"
                max="100"
                onChange={setVolume}
                data-drag="disabled"
                defaultValue={settings ? settings.volume * 100 : 100}
            />

            <div className="Control__options">
                <i
                    className="Control__option Control__icon material-icons md-light md-18"
                    data-drag="disabled"
                    onClick={toggleMute}
                >
                    {settings && settings.audioEnabled ? 'mic' : 'mic_off'}
                </i>
                {!isEmpty(commonConversation) && isMoreThanTwoMembers && (
                    <i
                        className="Control__option Control__icon material-icons md-light md-18"
                        data-drag="disabled"
                        onClick={handleDisconnectMember}
                    >
                        cancel
                    </i>
                )}
            </div>
        </div>
    );
};

export default VolumeControl;
