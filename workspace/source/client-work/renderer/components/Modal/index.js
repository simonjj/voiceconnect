import React from 'react';
import Modal from 'react-modal';

import './style.css';

const main = document.getElementById('main');

const ConnectModal = ({ children, customStyles, open, transform }) => {
    const _customStyles = {
        overlay: {
            ...(customStyles.overlay || {})
        },
        content: {
            ...(customStyles.content || {})
        },
        container: {
            ...(customStyles.container || {})
        }
    };

    const modalStyles = {
        overlay: {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0)',
            ..._customStyles.overlay
        },
        content: {
            top: null,
            bottom: null,
            left: null,
            right: null,
            border: 'none',
            background: 'none',
            padding: 0,
            transform: `translate(${transform[0] / 3}%, ${transform[1] / 3}%)`,
            ..._customStyles.content
        }
    };

    return (
        <Modal parentSelector={() => main} isOpen={open} style={modalStyles}>
            <div
                className="click-on modal-container"
                style={_customStyles.container}
            >
                {children}
            </div>
        </Modal>
    );
};

ConnectModal.defaultProps = {
    customStyles: {
        overlay: {},
        content: {},
        container: {}
    }
};

export default ConnectModal;
