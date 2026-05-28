/* istanbul ignore file*/
import React, { useEffect, useState, useRef } from 'react';
import * as speechCommands from '@tensorflow-models/speech-commands';
import propTypes from 'prop-types';

import WordCollector from './WordCollector';
import {
    GET_SERIALIZED_SPEECH_EXAMPLES,
    SAVE_SERIALIZED_SPEECH_EXAMPLES,
    BG_NOISE,
    START_CONVERSATION_EVENT,
    END_CONVERSATION_EVENT
} from '../../../shared/constants';
import './VoiceTraining.css';
import { useTeamMembers } from '../../hooks/useTeamMembers';

const { ipcRenderer } = window;

const CONNECT_WITH = 'Connect With';
const CLOSE_CONNECTION = 'Close Connection With';

const VoiceTraining = ({ listenOnCompleteTraining }) => {
    const teamMembers = useTeamMembers();
    const teamMemberNames = teamMembers.map((tm) => tm.nickname);
    const words = [
        CONNECT_WITH,
        CLOSE_CONNECTION,
        BG_NOISE,
        ...teamMemberNames
    ];
    const { current: baseRecognizer } = useRef(
        speechCommands.create('BROWSER_FFT')
    );
    const [modelLoaded, setModelLoaded] = useState(false);
    const [transferRecognizer, setTransferRecognizer] = useState(null);
    const [trainingResults, setTrainingResults] = useState({
        epoch: 0,
        loss: 0,
        accuracy: 0
    });
    const [listening, setListening] = useState(false);
    const [examplesLoaded, setExamplesLoaded] = useState(false);
    const [training, setTraining] = useState(false);
    const [knownWords, setKnownWords] = useState([]);

    const [detectedWords, setDetectedWords] = useState([]);
    const [needsTraining, setNeedsTraining] = useState(true);

    useEffect(
        () => {
            (async function() {
                if (!modelLoaded) {
                    await baseRecognizer.ensureModelLoaded();
                    setModelLoaded(true);
                    setTransferRecognizer(
                        baseRecognizer.createTransfer('custom')
                    );
                }
            })();
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    useEffect(
        () => {
            if (!modelLoaded || !transferRecognizer || examplesLoaded) return;
            loadStoredExamples();
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [modelLoaded, transferRecognizer, examplesLoaded]
    );

    useEffect(
        handleDetectedWordChange,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [detectedWords]
    );

    function handleDetectedWordChange() {
        if (detectedWords.length > 1) {
            const name = detectedWords.find(
                (w) => !!teamMemberNames.includes(w)
            );

            const connectWithDetected = detectedWords.includes(CONNECT_WITH);
            const closeConnectionDetected = detectedWords.includes(
                CLOSE_CONNECTION
            );
            if (connectWithDetected && closeConnectionDetected) {
                setDetectedWords((words) =>
                    words.slice(
                        Math.max(
                            words.indexOf(CONNECT_WITH),
                            words.indexOf(CLOSE_CONNECTION)
                        )
                    )
                );
            }

            if (name) {
                const id = teamMembers.find((tm) => tm.nickname === name)._id;
                if (detectedWords.includes(CONNECT_WITH)) {
                    ipcRenderer.invoke(START_CONVERSATION_EVENT, id);
                    setDetectedWords([]);
                } else if (detectedWords.includes(CLOSE_CONNECTION)) {
                    ipcRenderer.invoke(END_CONVERSATION_EVENT, id);
                    setDetectedWords([]);
                }
            }
        }
    }

    async function loadStoredExamples() {
        const storedExamples = await ipcRenderer.invoke(
            GET_SERIALIZED_SPEECH_EXAMPLES
        );

        if (storedExamples && storedExamples instanceof ArrayBuffer) {
            transferRecognizer.loadExamples(storedExamples, false);
            const knownWords = transferRecognizer.wordLabels();
            setKnownWords(knownWords);
            await train(false);
        }
        setExamplesLoaded(true);
    }

    async function train(save = true) {
        if (!modelLoaded || !transferRecognizer) {
            return;
        }
        setTraining(true);

        await transferRecognizer.train({
            epochs: 200,
            callback: {
                onEpochEnd: async (epoch, logs) => {
                    setTrainingResults({
                        epoch,
                        loss: logs.loss,
                        accuracy: logs.acc
                    });
                }
            }
        });

        if (save) {
            const serializedExamples = transferRecognizer.serializeExamples();
            ipcRenderer.invoke(
                SAVE_SERIALIZED_SPEECH_EXAMPLES,
                serializedExamples
            );
        }
        setKnownWords(transferRecognizer.wordLabels());
        setTraining(false);
        setNeedsTraining(false);
        if (listenOnCompleteTraining) {
            listen();
        }
    }

    async function listen() {
        if (transferRecognizer.isListening()) {
            transferRecognizer.stopListening();
        }
        setListening(true);
        await transferRecognizer.listen(
            (result) => {
                const words = transferRecognizer.wordLabels();
                const wordScores = Array.from(result.scores).map((s, i) => ({
                    score: s,
                    word: words[i]
                }));

                const [{ word }] = wordScores.sort(
                    (s1, s2) => s2.score - s1.score
                );

                if (word !== BG_NOISE) {
                    setDetectedWords((prev) => [...prev, word]);
                }
            },
            {
                probabilityThreshold: 0.95,
                includeSpectrogram: true
            }
        );
    }

    async function endListening() {
        if (transferRecognizer && transferRecognizer.isListening()) {
            await transferRecognizer.stopListening();
        }
        setListening(false);
    }

    function markWordCollected() {
        setNeedsTraining(true);
    }

    if (!modelLoaded || !transferRecognizer) {
        return <div>Loading model</div>;
    }

    if (training) {
        return (
            <div className="voice-training-container">
                <h4>Training Model...</h4>
                <div>
                    <p>Epoch: {trainingResults.epoch}</p>
                    <p>Loss: {trainingResults.loss}</p>
                    <p>Accuracy: {trainingResults.accuracy}</p>
                </div>
            </div>
        );
    }

    if (!examplesLoaded) {
        return (
            <div className="voice-training-container">
                <h4>Loading examples...</h4>
            </div>
        );
    }

    const unknownWords = words.filter((w) => !knownWords.includes(w));

    return (
        <div className="voice-training-container">
            {!!knownWords.length && !listening && (
                <>
                    <h4>
                        Known words/phrases. Click the button to record more
                        examples
                    </h4>
                    {knownWords.map((w) => (
                        <WordCollector
                            endListening={endListening}
                            key={w}
                            isKnown={true}
                            onCompleteCollection={markWordCollected}
                            recognizer={transferRecognizer}
                            word={w}
                        />
                    ))}
                </>
            )}

            {!!unknownWords.length && !listening && (
                <>
                    <h4>Record at least 10 examples of each word/phrase</h4>
                    {unknownWords.map((w) => (
                        <WordCollector
                            endListening={endListening}
                            key={w}
                            isKnown={false}
                            onCompleteCollection={markWordCollected}
                            recognizer={transferRecognizer}
                            word={w}
                        />
                    ))}
                </>
            )}
            {needsTraining && (
                <button onClick={train}>
                    Train model to register new words/phrases.
                </button>
            )}
            {listening ? (
                <>
                    <h4>
                        Listening in progress. Stop listening to record more
                        examples
                    </h4>
                    {!!unknownWords.length && (
                        <h5>
                            You are missing examples for the following team
                            members or phrases:{' '}
                            {unknownWords.map((w) => `${w}, `)}
                        </h5>
                    )}
                    <button onClick={endListening}>End listening</button>
                </>
            ) : (
                <button onClick={listen}>Listen</button>
            )}
        </div>
    );
};

VoiceTraining.defaultProps = {
    listenOnCompleteTraining: true
};

VoiceTraining.propTypes = {
    listenOnCompleteTraining: propTypes.bool.isRequired
};

export default VoiceTraining;
