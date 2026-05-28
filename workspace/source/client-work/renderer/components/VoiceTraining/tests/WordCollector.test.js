import React from 'react';
//import { act } from '@testing-library/react';
import { render } from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';

import WordCollector from '../WordCollector';
import { BG_NOISE } from '../../../../shared/constants';
import { testId } from '../../../lib/utils';

const mockRecognizer = {
    isListening: jest.fn(),
    stopListening: jest.fn(),
    collectExample: jest.fn()
};

const defaultProps = {
    isKnown: false,
    minExamples: 10,
    onCompleteCollection: jest.fn(),
    recognizer: mockRecognizer,
    word: 'connect'
};

function selectCollectBtn(container) {
    return container.querySelector(testId('collect-btn'));
}

describe('WordCollector', () => {
    test('displays word', async () => {
        const word = 'connect with';

        await act(async () => {
            render(<WordCollector {...defaultProps} word={word} />, container);
        });

        expect(container.textContent).toContain(word);
    });
    test('displays _background_noise_ constant as "background noise"', async () => {
        await act(async () => {
            render(
                <WordCollector {...defaultProps} word={BG_NOISE} />,
                container
            );
        });

        expect(container.textContent).not.toContain(BG_NOISE);
        expect(container.textContent).toContain('background noise');
    });
    test('Shows Examples Collected count when isKnown is false', async () => {
        await act(async () => {
            render(<WordCollector {...defaultProps} />, container);
        });

        expect(container.textContent).toContain('Examples Collected');
    });
    test('Does not show Examples Collected when word is already known', async () => {
        await act(async () => {
            render(
                <WordCollector {...defaultProps} isKnown={true} />,
                container
            );
        });

        expect(container.textContent).not.toContain('Examples Collected');
    });
    test('stopListening is called if recognizer is already listening', async () => {
        mockRecognizer.isListening.mockImplementationOnce(() => true);

        await act(async () => {
            render(
                <WordCollector {...defaultProps} recognizer={mockRecognizer} />,
                container
            );
        });

        const collectBtn = selectCollectBtn(container);

        await act(async () => {
            Simulate.click(collectBtn);
        });

        expect(mockRecognizer.stopListening).toHaveBeenCalled();
    });
    test('onCompleteCollection is called when enough examples have been collected', async () => {
        await act(async () => {
            render(
                <WordCollector {...defaultProps} minExamples={1} />,
                container
            );
        });

        const collectBtn = selectCollectBtn(container);

        await act(async () => {
            Simulate.click(collectBtn);
        });

        expect(defaultProps.onCompleteCollection).toHaveBeenCalled();
    });
});
