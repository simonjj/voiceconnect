import { useContext } from 'react';

import { TeamServiceContext } from '../contexts/TeamServiceContext';

const useTeam = () => {
    const { team } = useContext(TeamServiceContext);

    const methods = {};

    return [team, methods];
};

export default useTeam;
