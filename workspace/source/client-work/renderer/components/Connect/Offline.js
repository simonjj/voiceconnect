import './style.scss';
import React from 'react';
import {
    handlePointerDown,
    handlePointerUp
} from '../../utilities/dragFunctions';

const ConnectOffline = () => (
    <div
        className="Connect"
        onPointerDown={(e) => handlePointerDown(e, ['dragstart'])}
        onPointerUp={() => handlePointerUp(['dragend'])}
    >
        <span className="User">
            <div className="User__shadow" />
            <div
                className="User__orb--offline"
                style={{ backgroundColor: 'grey' }}
            >
                <div className="flexbox-center">
                    <i className="material-icons md-36 md-light">
                        perm_scan_wifi
                    </i>
                </div>
            </div>
        </span>
    </div>
);

export default ConnectOffline;
