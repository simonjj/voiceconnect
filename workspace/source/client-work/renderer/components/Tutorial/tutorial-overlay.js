import React from 'react';
import propTypes from 'prop-types';
import { TutorialModal } from './tutorial-modal';
import './style.scss';

const TutorialOverlay = ({ step, onNext, onPrev, onFinish }) => {
    return (
        <div className="Overlay">
            <div className="Overlay__inner">
                <TutorialModal
                    onBack={onPrev}
                    onFinish={onFinish}
                    onNext={onNext}
                    step={step}
                />
            </div>
        </div>
    );
};

TutorialOverlay.propTypes = {
    step: propTypes.string,
    onNext: propTypes.func,
    onPrev: propTypes.func,
    onFinish: propTypes.func
};

export default TutorialOverlay;
