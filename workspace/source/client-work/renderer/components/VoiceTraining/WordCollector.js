import React, { useState } from 'react';
import propTypes from 'prop-types';

import { BG_NOISE } from '../../../shared/constants';

const WordCollector = ({
    isKnown,
    minExamples,
    onCompleteCollection,
    recognizer,
    word
}) => {
    const [collecting, setCollecting] = useState(false);
    const [exampleCount, setExampleCount] = useState(0);

    async function handleCollect() {
        if (recognizer.isListening()) {
            recognizer.stopListening();
        }
        setCollecting(true);
        await recognizer.collectExample(word);
        setCollecting(false);
        if (exampleCount + 1 >= minExamples || isKnown) {
            onCompleteCollection(word);
        }
        setExampleCount((prevCount) => prevCount + 1);
    }

    const displayedWord = word === BG_NOISE ? 'background noise' : word;

    return (
        <>
            <button
                data-testid="collect-btn"
                disabled={collecting}
                onClick={handleCollect}
            >{`Collect '${displayedWord}'`}</button>
            <div>
                {!isKnown &&
                    `Examples Collected: ${exampleCount}/${minExamples}`}
            </div>
        </>
    );
};

WordCollector.defaultProps = {
    isKnown: false,
    minExamples: 10
};

WordCollector.propTypes = {
    isKnown: propTypes.bool,
    minExamples: propTypes.number.isRequired,
    onCompleteCollection: propTypes.func.isRequired,
    // TS type for recognizer is speechCommands.SpeechCommandRecognizer but that does not work with propTypes.instanceOf
    recognizer: propTypes.object.isRequired,
    word: propTypes.string.isRequired
};

export default WordCollector;
