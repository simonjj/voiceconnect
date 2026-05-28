import React, { useMemo } from 'react';
import clx from 'clsx';
import loadable from '@loadable/component';
import { TUTORIAL_STEPS } from '../constants';

const Button = loadable(() =>
    import(/* webpackChunkName: "tutorial-button" */ '@material-ui/core/Button')
);
import './style.scss';
import { isEmpty } from '../../../utilities/isEmpty';

export const TutorialModal = ({
    onBack,
    onNext,
    onFinish,
    step,
    className = ''
}) => {
    const maxStep = Object.values(TUTORIAL_STEPS).length;

    const windowContent = useMemo(() => {
        if (step) {
            return {
                content: TUTORIAL_STEPS[`step_${step}`].content,
                title: TUTORIAL_STEPS[`step_${step}`].title
            };
        }
        return {};
    }, [step]);

    return (
        <div className={clx('Tutorial-modal', className)}>
            <span className="Tutorial-modal__title">
                {!isEmpty(windowContent) && windowContent.title.toUpperCase()}
            </span>
            <span className="Tutorial-modal__content">
                {!isEmpty(windowContent) && windowContent.content}
            </span>
            <div className="Tutorial-modal__actions">
                <Button
                    disableRipple
                    onClick={step !== 1 ? onBack : onFinish}
                    data-drag="disabled"
                >
                    <i className="material-icons md-36">
                        {step === 1 ? 'close' : 'arrow_back'}
                    </i>
                </Button>
                {step !== maxStep && step !== 1 && (
                    <Button onClick={onFinish} data-drag="disabled">
                        <i className="material-icons md-36">close</i>
                    </Button>
                )}
                <Button
                    disableRipple
                    onClick={step !== maxStep ? onNext : onFinish}
                    data-drag="disabled"
                >
                    {step !== maxStep ? (
                        <i className="material-icons md-36">arrow_forward</i>
                    ) : (
                        'Finish'
                    )}
                </Button>
            </div>
        </div>
    );
};
