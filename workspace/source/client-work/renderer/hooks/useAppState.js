/* istanbul ignore file */
import { useContext } from 'react';

import { AppStateContext } from '../contexts/AppStateContext';
import { makeSetAppState } from '../lib/appStateHelpers';

export const useAppState = () => [
    useContext(AppStateContext),
    makeSetAppState()
];
