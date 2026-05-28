import React, { useEffect, useState } from 'react';
import loadable from '@loadable/component';

const Button = loadable(() =>
    import(/* webpackChunkName: "mdl-Button" */ '@material-ui/core/Button')
);
const IconButton = loadable(() =>
    import(
        /* webpackChunkName: "mdl-IconButton" */ '@material-ui/core/IconButton'
    )
);
const TextField = loadable(() =>
    import(
        /* webpackChunkName: "mdl-TextField" */ '@material-ui/core/TextField'
    )
);

import keyCodeMap, { modKeys } from './keyCodeMap';
import { useAppState } from '../../../hooks/useAppState';
import './style.css';

const KeyComboCapture = ({ handleSave, value }) => {
    const [{ hotkeys }] = useAppState();
    const [combo, setCombo] = useState([]);
    const [capturing, setCapturing] = useState(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState(null);

    const comboTaken = Object.values(hotkeys).includes(stringifyCombo(combo));
    const modKeyNames = Object.values(modKeys);
    const nonModKeyNames = Object.values(keyCodeMap).filter(
        (k) => !modKeyNames.includes(k)
    );
    const hasModKey = !!combo.find((k) => modKeyNames.includes(k));
    const hasNonModKey = !!combo.find(
        (k) =>
            nonModKeyNames.includes(k) ||
            (k.length === 1 &&
                k.charCodeAt(0) >= 97 &&
                k.charCodeAt(0) <= 122) ||
            !isNaN(Number(k))
    );

    useEffect(() => {
        function handleKeyDown(e) {
            if (!capturing && !deleteConfirmation) return;
            const keyName = keyCodeMap[e.keyCode] || e.key;
            if (keyName === 'esc') {
                capturing ? handleCaptureEnd() : cancelDeleteConfirmation();
                return;
            }
            if (!validateOnKeyDown(keyName)) return;

            setCombo((prevCombo) => [...prevCombo, keyName.toLowerCase()]);
        }
        document.documentElement.addEventListener('keydown', handleKeyDown);

        return () => {
            document.documentElement.removeEventListener(
                'keydown',
                handleKeyDown
            );
        };
    }, [combo, deleteConfirmation]);

    function cancelCapture(e) {
        e.preventDefault();
        setCapturing(false);
        setCombo([]);
    }

    function cancelDeleteConfirmation(e) {
        e && e.preventDefault();
        setDeleteConfirmation(false);
    }

    function handleCaptureEnd(e) {
        e && e.preventDefault();
        setCapturing(false);
        if (isValid()) {
            handleSave(stringifyCombo(combo));
        }
        setCombo([]);
    }

    function startCapture(e) {
        e.preventDefault();
        setCombo([]);
        setCapturing(true);
    }

    function confirmDelete(e) {
        e.preventDefault();
        setDeleteConfirmation(true);
    }

    function stringifyCombo(combo) {
        if (typeof combo === 'string') return combo;

        return combo.reduce((str, k, i) => (i ? `${str}+${k}` : k), '');
    }

    function validateOnKeyDown(keyName) {
        if (!keyName) return false;
        if (combo.includes(keyName)) return false;
        if (!combo.length && !modKeyNames.includes(keyName)) return false;

        return true;
    }

    function deleteHotkey(e) {
        e.preventDefault();
        handleSave(null);
        setDeleteConfirmation(false);
    }

    function isValid() {
        if (combo.length < 2) return false;

        if (comboTaken) return false;

        return hasModKey && hasNonModKey;
    }

    const StyledCombo = ({ combo }) => {
        if (!combo || !combo.length) {
            return null;
        }

        const comboElems = stringifyCombo(combo)
            .split('+')

            .map((val, i, arr) => (
                <span key={`${val}-${i}`}>
                    <code className="kbd">{val}</code>
                    {i !== arr.length - 1 && (
                        <span className="styled-combo-plus">+</span>
                    )}
                </span>
            ));

        return <div className="c-hotkey__input">{comboElems}</div>;
    };

    return (
        <div>
            {capturing || deleteConfirmation ? (
                <div className="o-flex--align-items--baseline c-hotkey--edit">
                    {capturing ? (
                        <div>
                            <TextField
                                id="formatted-text-mask-input"
                                className="mdl-textfield"
                                helperText="Please enter a hotkey combination of at least two modifier keys (e.g. {shift} and {ctrl}) and one additional key (e.g. {g})"
                                InputProps={{
                                    readOnly: true
                                }}
                            />
                            <StyledCombo combo={combo} />
                        </div>
                    ) : (
                        <p>Are you sure you want to delete this hotkey?</p>
                    )}

                    <Button
                        className="mdl-button mdl-button--raised mdl-button--colored"
                        disabled={capturing && !isValid()}
                        onClick={capturing ? handleCaptureEnd : deleteHotkey}
                    >
                        Accept
                    </Button>

                    <Button
                        className="mdl-button mdl-button--colored"
                        onClick={
                            capturing ? cancelCapture : cancelDeleteConfirmation
                        }
                    >
                        Cancel
                    </Button>
                </div>
            ) : (
                <div className="c-hotkey--current o-flex--align-items-center">
                    <StyledCombo combo={value} />

                    <Button
                        className="mdl-button mdl-button--raised  mdl-button--colored"
                        onClick={startCapture}
                        variant="contained"
                    >
                        {value && !!value.length
                            ? 'Edit hotkey'
                            : 'Enter hotkey'}
                    </Button>

                    {value && !!value.length && (
                        <Button className="c-hotkey__clear">
                            <i
                                className="material-icons"
                                onClick={confirmDelete}
                            >
                                clear
                            </i>
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
};

export default KeyComboCapture;
