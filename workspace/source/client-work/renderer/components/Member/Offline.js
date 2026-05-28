import './style.scss';
import React, { useState, useLayoutEffect } from 'react';

import clx from 'clsx';

export default ({ className, switchingPages = false, member }) => {
    const [welcome, setWelcome] = useState(false);
    useLayoutEffect(() => {
        let bounce = null;
        const abortController = new AbortController();
        bounce = setTimeout(() => {
            bounce = setTimeout(
                () => !abortController.signal.aborted && setWelcome(false),
                1500
            );
            if (!abortController.signal.aborted) setWelcome(true);
        }, 50);

        return () => {
            clearTimeout(bounce);
            abortController.abort();
        };
    }, []);

    return (
        <div
            className={clx(
                'Member',
                'Member--offline',
                welcome && 'Member--visible',
                className
            )}
            data-switching={switchingPages}
        >
            <div className="Member__orb">{member.initials}</div>
        </div>
    );
};
