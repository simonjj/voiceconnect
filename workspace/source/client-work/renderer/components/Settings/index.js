import React from 'react';
import propTypes from 'prop-types';
import loadable from '@loadable/component';

import { useAppState } from '../../hooks/useAppState';
import { SETTINGS_VIEWS } from '../../../shared/constants';
import Tabs from './Tabs';

import './style.css';

const MainSettings = loadable(() =>
    import(/* webpackChunkName: "settings-audio-settings" */ '../MainSettings')
);

const Help = loadable(() =>
    import(/* webpackChunkName: "settings-help" */ '../Help')
);

const Profile = loadable(() =>
    import(/* webpackChunkName: "settings-profile" */ '../Profile')
);

const SettingsView = ({ className, view }) => {
    switch (view) {
        case SETTINGS_VIEWS.PROFILE:
            return <Profile className={className} />;
        case SETTINGS_VIEWS.SETTINGS_MAIN:
            return <MainSettings className={className} />;
        case SETTINGS_VIEWS.HELP:
            return <Help className={className} />;
        default:
            return <div>No view yet</div>;
    }
};

const Settings = () => {
    const [appState] = useAppState();

    return (
        <div>
            <Tabs />
            <SettingsView className="c-content" view={appState.settingsView} />
        </div>
    );
};

SettingsView.propTypes = {
    className: propTypes.string,
    view: propTypes.oneOf([
        SETTINGS_VIEWS.PROFILE,
        SETTINGS_VIEWS.SETTINGS_MAIN,
        SETTINGS_VIEWS.HELP
    ])
};

export default Settings;
