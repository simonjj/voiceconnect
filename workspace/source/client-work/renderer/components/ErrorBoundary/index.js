import React from 'react';
import propTypes from 'prop-types';

import { APP_ERROR_CAUGHT } from '../../../shared/constants';

import ipcRenderer from '../../lib/ipcRenderer';

class ErrorBoundary extends React.Component {
    constructor() {
        super();
        this.state = {
            hasError: false
        };
    }

    async componentDidCatch(error, info) {
        if (!this.state.hasError) {
            this.setState({ hasError: true });
            await ipcRenderer.invoke(APP_ERROR_CAUGHT, { error, info });
        }
    }
    render() {
        return this.props.children;
    }
}

ErrorBoundary.propTypes = {
    children: propTypes.node.isRequired
};

export default ErrorBoundary;
