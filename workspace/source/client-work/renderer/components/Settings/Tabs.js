import React from 'react';
import clsx from 'clsx';

import { SETTINGS_VIEWS } from '../../../shared/constants';
import { useAppState } from '../../hooks/useAppState';

const Tabs = () => {
    const [appState, setAppState] = useAppState();

    const options = {
        [SETTINGS_VIEWS.PROFILE]: 'Profile',
        [SETTINGS_VIEWS.SETTINGS_MAIN]: 'Settings',
        [SETTINGS_VIEWS.HELP]: 'Help'
    };

    const isSelected = (view) => appState.settingsView === view;

    const selectView = (view) => () =>
        setAppState({
            settingsView: view
        });

    return (
        <div className="c-nav--tabs">
            {Object.entries(options).map(([view, title]) => (
                <div
                    className="c-nav__item"
                    key={view}
                    onClick={selectView(view)}
                >
                    <span
                        className={clsx(
                            'c-nav__text',
                            isSelected(view) && 'is-selected'
                        )}
                    >
                        {title}
                    </span>
                </div>
            ))}
        </div>
    );
};

export default Tabs;
