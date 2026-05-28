import React from 'react';
import { render } from 'react-dom';

import loadable from '@loadable/component';
const Theme = loadable(() =>
    import(/* webpackChunkName: "ConnectTheme" */ '../utilities/Theme')
);

import Welcome from '../components/Welcome';

const welcomeEl = document.getElementById('welcome');

render(
    <>
        <Theme />
        <Welcome />
    </>,
    welcomeEl
);
