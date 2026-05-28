import { useReducer, useEffect, useCallback } from 'react';

function reducer(state, action) {
    switch (action.type) {
        case 'ADD':
            return {
                ...state,
                queue: [...state.queue, action.payload]
            };
        case 'PROCESSING':
            return {
                ...state,
                isProcessing: true
            };
        case 'PROCESSED':
            return {
                isProcessing: false,
                queue: state.queue.slice(1)
            };
        default:
            return state;
    }
}

const initialState = {
    isProcessing: false,
    queue: []
};

const useQueue = (process) => {
    const [{ isProcessing, queue }, dispatch] = useReducer(reducer, {
        ...initialState
    });

    const add = useCallback((payload) => {
        dispatch({ type: 'ADD', payload });
    }, []);

    useEffect(() => {
        if (queue.length > 0 && !isProcessing) {
            dispatch({ type: 'PROCESSING' });
            process(queue[0], () => {
                dispatch({ type: 'PROCESSED' });
            });
        }
    }, [queue, isProcessing]); //eslint-disable-line react-hooks/exhaustive-deps

    return add;
};

export default useQueue;
