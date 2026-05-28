import React from 'react';

const classes =
    'mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-button--accent';

const PrivateConversationWarning = () => {
    return (
        <div>
            <h4>Unable to provide private conversation</h4>
            <p>
                It would appear that other member(s) of this conversation do not
                have the latest version of Connect.
            </p>
            <p>
                Tell your team members to upgrade to the latest Connect to
                enable private conversations
            </p>
            <div className="buttonBar">
                <button className={classes} onClick={() => window.close()}>
                    Dismiss
                </button>
            </div>
        </div>
    );
};

export default PrivateConversationWarning;
