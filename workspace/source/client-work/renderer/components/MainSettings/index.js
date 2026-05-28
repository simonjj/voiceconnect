import React from 'react';
import clsx from 'clsx';
import propTypes from 'prop-types';
import AudioSettings from './AudioSettings';
import Hotkeys from './Hotkeys';

import './styles.scss';

const MainSettings = ({ className }) => {
    return (
        <div className={clsx('settings-main', className)}>
            <AudioSettings />
            <Hotkeys />
        </div>
    );
};

MainSettings.propTypes = {
    className: propTypes.string
};

export default MainSettings;
