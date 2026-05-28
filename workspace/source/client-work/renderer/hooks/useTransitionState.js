import { useEffect, useState } from 'react';
import { usePrevious } from './usePrevious';
import { useTimeout } from './useTimeout';

export const useTransitionState = (shouldTransition, transitionDelay) => {
    const states = {
        exited: 'exited',
        entering: 'entering',
        entered: 'entered',
        exiting: 'exiting'
    };
    const [transitionState, setTransitionState] = useState(
        shouldTransition ? states.entered : states.exited
    );
    const prevState = usePrevious(shouldTransition);
    const { setTimeoutCallback, setTimeoutDelay } = useTimeout(transitionDelay);

    function isCurrentState(val) {
        return transitionState === val;
    }
    function setNextState(state) {
        return () => setTransitionState(state);
    }

    useEffect(() => {
        setTimeoutDelay(transitionDelay);
    }, [transitionDelay]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (prevState === shouldTransition) return;
        if (shouldTransition) {
            if (
                isCurrentState(states.exited) ||
                isCurrentState(states.exiting)
            ) {
                setTransitionState(states.entering);
                setTimeoutCallback(setNextState(states.entered));
            }
        } else {
            if (
                isCurrentState(states.entered) ||
                isCurrentState(states.entering)
            ) {
                setTransitionState(states.exiting);
                setTimeoutCallback(setNextState(states.exited));
            }
        }
    }, [shouldTransition]); // eslint-disable-line react-hooks/exhaustive-deps

    return {
        isCurrentTransitionState: isCurrentState,
        transitionState,
        transitionStates: states
    };
};
