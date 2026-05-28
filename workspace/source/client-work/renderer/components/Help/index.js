import React, { useState, useRef, useEffect, useCallback } from 'react';
import { fetchHelpContent } from '../../requests';
import './style.css';

const Help = ({ className }) => {
    const [content, setContent] = useState(null);
    const helpRef = useRef(null);

    const getHelpContent = useCallback(async () => {
        const content = await fetchHelpContent();
        setContent(content);
    }, []);

    useEffect(() => {
        getHelpContent();
    }, [getHelpContent]);

    if (!content) {
        return null;
    }

    const handleClick = (e) => {
        const toc = e.target.closest('#markdown-toc');
        if (e.target.tagName === 'A' && toc) {
            window.location.hash = e.target.hash;
            e.preventDefault && e.preventDefault();
            e.stopPropagation && e.stopPropagation();
        }
    };

    return (
        <>
            <div
                className={`${className} c-help`}
                dangerouslySetInnerHTML={{ __html: content }}
                ref={helpRef}
                onClick={handleClick}
            />
            <p className="connect-version">Connect version: {APP_VERSION}</p>
        </>
    );
};

export default Help;
