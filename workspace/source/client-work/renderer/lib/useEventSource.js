/* istanbul ignore file */
import { useEffect, useRef, useState } from 'react';

const eventSourceReadyStates = ['connecting', 'open', 'closed', 'error'];

const useEventSource = (url) => {
    const source = useRef(null);
    const [readyState, setReadyState] = useState(2);

    useEffect(() => {
        if (url) {
            const es = new EventSource(url);
            source.current = es;

            es.addEventListener('open', () => setReadyState(es.readyState));
            es.addEventListener('error', () => setReadyState(3));
            return () => {
                source.current = null;
                es.close();
            };
        }
        setReadyState(2);
        return undefined;
    }, [url]);

    return [source.current, readyState];
};

const useEventSourceListener = (
    source,
    types = [],
    listener,
    dependencies = []
) => {
    useEffect(
        () => {
            if (source) {
                types.forEach((type) =>
                    source.addEventListener(type, listener)
                );
                return () =>
                    types.forEach((type) =>
                        source.removeEventListener(type, listener)
                    );
            }
            return undefined;
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [source, ...dependencies]
    );
};

export { useEventSource, useEventSourceListener, eventSourceReadyStates };
