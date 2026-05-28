/* eslint-disable camelcase */
const config = require('config');
const debug = require('debug')('ttc:main:auth');
const jwt = require('jsonwebtoken');
const request = require('superagent');
const keytar = require('keytar');
const { URL, URLSearchParams } = require('url');
const { BrowserWindow, app, shell } = require('electron');

const { username: account } =
    (config.app.auth.username && config.app.auth) || require('os').userInfo();

const { apiBaseURL } = config.app;

const isNetworkError = require('../utils/isNetworkError');
const { endConversation } = require('./requests');

const {
    keyname_base,
    apiIdentifier: audience,
    client_id,
    issuerBaseURL,
    scope,
    secret,
    inAppAuth
} = config.get('app.auth');

let access_token = null;
let profile = null;
let refresh_token = null;

let key_access = `${keyname_base}_access`;

const redirect_uri = inAppAuth
    ? 'http://localhost/callback'
    : `${apiBaseURL}/auth-redirect`;

const logout_uri = inAppAuth
    ? `https://${issuerBaseURL}/v2/logout`
    : `${apiBaseURL}/logout-redirect`;

function checkValid() {
    try {
        const { exp } = jwt.decode(access_token);
        const current = Math.floor(+Date.now() / 1000);

        return exp > current;
    } catch (err) {
        return false;
    }
}

const getAccessToken = () => access_token;
const getProfile = () => profile;

const logout = async () => {
    await keytar.deletePassword(key_access, account);

    access_token = null;
    profile = null;
};
const logoutAndExit = async (relaunch = false) => {
    const finishLogout = async () => {
        await endConversation();
        await logout();
        if (relaunch) {
            process.env.LAUNCH_TYPE = 'relaunch';
            app.relaunch();
        }
        app.exit(0);
    };

    if (inAppAuth) {
        const win = new BrowserWindow({ show: false });
        await win.loadURL(logout_uri);
        win.on('ready-to-show', async () => {
            win.close();
            await finishLogout();
        });
    } else {
        await shell.openExternal(
            `https://${issuerBaseURL}/v2/logout?client_id=${client_id}&returnTo=${logout_uri}`
        );
        await finishLogout();
    }
};

//: `${apiBaseURL}/auth-redirect`;
const getAuthenticationUrl = (teamCode) => {
    const redirectUrl = teamCode
        ? `${redirect_uri}?teamCode=${teamCode}`
        : redirect_uri;
    const url = new URL('http://connect');
    url.hostname = issuerBaseURL;
    url.protocol = 'https:';
    url.pathname = 'authorize';
    url.search = new URLSearchParams({
        audience,
        client_id,
        redirect_uri: redirectUrl,
        scope,
        response_type: 'code',
        prompt: 'select_account'
    }).toString();

    return url.toString();
};

const saveTokens = async ({ refresh_token, access_token }) => {
    const token = jwt.sign({ refresh_token, access_token }, secret);
    await keytar.setPassword(key_access, account, token);
};

const refreshTokens = async (force = false) => {
    if (!refresh_token || !access_token) {
        const keys = await keytar.getPassword(key_access, account);
        if (keys) {
            const tokens = jwt.decode(
                await keytar.getPassword(key_access, account)
            );

            refresh_token = tokens.refresh_token;
            access_token = tokens.access_token;
        } else throw new Error('No available tokens');
    }

    if (refresh_token && access_token && checkValid(access_token)) {
        return;
    }

    if (refresh_token || force) {
        try {
            const res = await request
                .post(`https://${issuerBaseURL}/oauth/token`)
                .set('Content-Type', 'application/json')
                .send({
                    grant_type: 'refresh_token',
                    client_id,
                    refresh_token
                });

            if (res.ok) {
                access_token = res.body.access_token;
                profile = jwt.decode(res.body.id_token);

                if (res.body.refresh_token) {
                    await saveTokens({
                        refresh_token: res.body.refresh_token,
                        access_token
                    });
                }
            }
        } catch (err) {
            throw err;
        }
    } else {
        throw new Error('No available refresh token.');
    }
};

const loadTokens = async (callbackURL, authCode) => {
    const url = new URL(callbackURL);
    const code = authCode || url.searchParams.get('code');
    try {
        const res = await request
            .post(`https://${issuerBaseURL}/oauth/token`)
            .set('Content-Type', 'application/json')
            .send({
                grant_type: 'authorization_code',
                client_id,
                code,
                redirect_uri
            });

        if (res.ok) {
            access_token = res.body.access_token;
            profile = jwt.decode(res.body.id_token);
            if (res.body.refresh_token) {
                await saveTokens({
                    refresh_token: res.body.refresh_token,
                    access_token
                });
            }
        } else debug(res.err);
    } catch (err) {
        if (!isNetworkError(err)) {
            await logout();
        }
        debug('ERROR');
        throw err;
    }
};

module.exports = {
    getProfile,
    getAccessToken,
    getAuthenticationUrl,
    logout,
    refreshTokens,
    loadTokens,
    logoutAndExit
};
