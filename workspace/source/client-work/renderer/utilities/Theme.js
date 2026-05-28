import React from 'react';
import propTypes from 'prop-types';
import '../components/theme.scss';

const Theme = ({ children }) => <>{children}</>;
Theme.propTypes = {
    children: propTypes.oneOfType([
        propTypes.arrayOf(propTypes.node),
        propTypes.node
    ]).isRequired
};

export default Theme;
