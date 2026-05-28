import React from 'react';
import propTypes from 'prop-types';
import loadable from '@loadable/component';
import { useAppState } from '../../hooks/useAppState';
import { TEAM_SETTINGS_VIEWS } from '../../../shared/constants';
import Tab from './Tab';
import './style.css';

const TeamMainSettings = loadable(() =>
    import(/* webpackChunkName: "main-team-settings" */ '../TeamMainSettings')
);

const TeamSettingsView = ({ className, view }) => {
    switch (view) {
        case TEAM_SETTINGS_VIEWS.SETTINGS_MAIN:
            return <TeamMainSettings className={className} />;
        default:
            return <div>No view yet</div>;
    }
};

const TeamSettings = () => {
    const [appState] = useAppState();

    return (
        <div>
            <Tab />
            <TeamSettingsView
                className="c-content"
                view={appState.teamSettingsView}
            />
        </div>
    );
};

TeamSettingsView.propTypes = {
    className: propTypes.string,
    view: propTypes.any
};

export default TeamSettings;
