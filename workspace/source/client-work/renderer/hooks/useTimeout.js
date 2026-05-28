import { useEffect, useRef } from 'react';

export const useTimeout = (delay) => {
    const delayRef = useRef(delay);
    const timeoutRef = useRef(null);

    useEffect(() => () => clearTimeout(timeoutRef.current), []);

    function setTimeoutCallback(cb) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = window.setTimeout(cb, delayRef.current);
    }

    function setTimeoutDelay(delay) {
        delayRef.current = delay;
    }

    function clearCurrentTimeout() {
        clearTimeout(timeoutRef.current);
    }

    return { setTimeoutCallback, clearCurrentTimeout, setTimeoutDelay };
};
