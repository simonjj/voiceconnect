import React from 'react';

import KeyComboCapture from './KeyComboCapture';

const Hotkey = ({ label, handleSave, value }) => {
    return (
        <div className="o-form__field">
            <span className="o-form__subtitle">{label}</span>
            <KeyComboCapture handleSave={handleSave} value={value} />
        </div>
    );
};

export default Hotkey;
