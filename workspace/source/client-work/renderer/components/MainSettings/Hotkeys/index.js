import React from 'react';
import propTypes from 'prop-types';

import Hotkey from './Hotkey';
import { HOTKEY_CMDS, SET_HOT_KEY } from '../../../../shared/constants';
import { useAppState } from '../../../hooks/useAppState';
import { useTeamMembers } from '../../../hooks/useTeamMembers';
import ipcRenderer from '../../../lib/ipcRenderer';

const Hotkeys = () => {
    const [{ hotkeys }] = useAppState();
    const teamMembers = useTeamMembers();

    function saveHotkey(key) {
        return function(value) {
            ipcRenderer.invoke(SET_HOT_KEY, { key, value });
        };
    }

    return (
        <form className="c-hotkeys o-form">
            <fieldset>
                <span className="o-form__title">Hotkeys</span>
                <Hotkey
                    label="Open Door"
                    handleSave={saveHotkey(HOTKEY_CMDS.OPEN_DOOR)}
                    value={hotkeys[HOTKEY_CMDS.OPEN_DOOR]}
                />
                <Hotkey
                    label="Close Door"
                    handleSave={saveHotkey(HOTKEY_CMDS.CLOSE_DOOR)}
                    value={hotkeys[HOTKEY_CMDS.CLOSE_DOOR]}
                />
                <Hotkey
                    label="End Conversation"
                    handleSave={saveHotkey(HOTKEY_CMDS.END)}
                    value={hotkeys[HOTKEY_CMDS.END]}
                />
                {teamMembers.map((tm) => (
                    <Hotkey
                        key={tm._id}
                        label={`Connect with ${tm.nickname}`}
                        handleSave={saveHotkey(
                            `${HOTKEY_CMDS.CONNECT}-${tm._id}`
                        )}
                        value={hotkeys[`${HOTKEY_CMDS.CONNECT}-${tm._id}`]}
                    />
                ))}
            </fieldset>
        </form>
    );
};

Hotkeys.propTypes = {
    className: propTypes.string
};

export default Hotkeys;
