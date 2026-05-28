import { useEffect, useState } from 'react';

import { useAppState } from './useAppState';

export const useTeamMembers = (includeSelf = false) => {
    const [appState] = useAppState();
    const [teamMembers, setTeamMembers] = useState(getTeamMembers());

    useEffect(
        () => {
            setTeamMembers(getTeamMembers());
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [appState.team, appState.user]
    );

    function getTeamMembers() {
        if (!appState.team || !appState.team.members) return [];
        if (includeSelf) return appState.team.members;
        return appState.team.members.filter((m) => m._id !== appState.user._id);
    }

    return teamMembers;
};
