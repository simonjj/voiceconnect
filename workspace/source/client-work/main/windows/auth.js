/* eslint-disable camelcase */
const auth = require('../lib/auth');
const config = require('config');
const { BrowserWindow, app } = require('electron');

const {
    apiBaseURL,
    auth: { inAppAuth }
} = config.app;

let authWindow = null;

const redirect_uri = inAppAuth
    ? 'http://localhost/callback'
    : `${apiBaseURL}/auth-redirect`;

const createAuthWindow = () => {
    const destroyAuthWindow = () => {
        if (!authWindow) return;
        authWindow.close();
        authWindow = null;
    };

    return new Promise((resolve) => {
        authWindow = new BrowserWindow({
            width: 420,
            height: 675,
            frame: true,
            center: true,
            webPreferences: {
                partition: 'authentication',
                contextIsolation: true
            }
        });
        authWindow.webContents.userAgent = 'Chrome';
        authWindow.webContents.session.setUserAgent('Chrome');
        authWindow.setMenu(null);

        authWindow.loadURL(auth.getAuthenticationUrl());
        authWindow.on('close', () => {
            authWindow = null;
            app.quit();
        });

        authWindow.on('ready-to-show', () => {
            authWindow.focus();
        });

        const {
            session: { webRequest }
        } = authWindow.webContents;

        const filter = { urls: [`${redirect_uri}*`] };

        webRequest.onBeforeRequest(filter, async ({ url }) => {
            await auth.loadTokens(url);
            resolve(true);
            destroyAuthWindow();
        });
    });
};

module.exports = createAuthWindow;
