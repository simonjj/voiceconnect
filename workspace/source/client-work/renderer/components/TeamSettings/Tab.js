import React from 'react';
import clsx from 'clsx';
import { TEAM_SETTINGS_VIEWS } from '../../../shared/constants';
import { useAppState } from '../../hooks/useAppState';

const Tab = () => {
    const [appState, setAppState] = useAppState();

    const options = {
        [TEAM_SETTINGS_VIEWS.SETTINGS_MAIN]: `Main Settings`
    };

    const isSelected = (view) => appState.teamSettingsView === view;

    const selectView = (view) => () =>
        setAppState({
            teamSettingsView: view
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

export default Tab;
