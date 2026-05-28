import React from 'react';

function close() {
    window.close();
}

const classes =
    'mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-button--accent';

const AppUpdateNotAvailable = () => {
    return (
        <div>
            <h4>You have the latest version of Connect</h4>
            <div className="buttonBar">
                <button className={classes} onClick={close}>
                    Close
                </button>
            </div>
        </div>
    );
};

export default AppUpdateNotAvailable;
