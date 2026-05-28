/* istanbul ignore file */
import React from 'react';
import { render } from 'react-dom';

import loadable from '@loadable/component';
const Theme = loadable(() =>
    import(/* webpackChunkName: "ConnectTheme" */ '../utilities/Theme')
);

import Knock from '../components/Knock';

const knock = (document && document.querySelector('#knock')) || null;

render(
    <>
        <Theme />
        <Knock />
    </>,
    knock
);
