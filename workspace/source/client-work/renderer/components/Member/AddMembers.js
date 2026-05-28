import React from 'react';
import './style.scss';
import ipcRenderer from '../../lib/ipcRenderer';
import { OPEN_ONBOARDING_WINDOW } from '../../../shared/constants';

const AddMembers = () => {
    const openWindow = () => {
        ipcRenderer.invoke(OPEN_ONBOARDING_WINDOW);
    };

    return (
        <div className="Member Member__add">
            <div
                className=" Member__orb"
                onClick={openWindow}
                data-drag="disabled"
            >
                <i className="material-icons">person_add</i>
            </div>
        </div>
    );
};

export default AddMembers;
