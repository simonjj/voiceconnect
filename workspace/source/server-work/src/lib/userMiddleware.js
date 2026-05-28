/* istanbul ignore file */
const request = require('superagent');
const config = require('config');
const debug = require('./debug')('ttc:auth');
const jwtDecode = require('jwt-decode');

const User = require('../models/User');
const e = require('express');
const { contentSecurityPolicy } = require('helmet');

const { issuerBaseURL, rulesNamespace } = config.get('app.auth');
const { produce } = require('../lib/kafka');

const fetchAuth0Profile = async (accessToken) => {
    const res = await request
        .get(`${issuerBaseURL}userinfo`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Content-Type', 'application/json');

    return res.body;
};

// eslint-disable-next-line no-unused-vars
const userMiddleware = async (req, res, next) => {
    // eslint-disable-next-line no-unused-vars
    const machineID = req.headers['x-machine-id'];
    const appVersion = req.headers['x-application-version'];
    const [, accessToken] = req.headers.authorization.split(' ');
    const decoded = jwtDecode(accessToken);
    const email = decoded[`${rulesNamespace}email`];
    if (!email) {
        res.sendStatus(401);
        return;
    }
    const user = await User.findOne({ email }).populate('team', 'code');
    if (user) {
        if (!user.online) {
            req.user = await User.findOneAndUpdate(
                { email },
                {
                    $set: {
                        online: true,
                        lastLogin: Date.now(),
                        machineID,
                        appVersion
                    }
                },
                { new: true }
            ).populate('team', 'code');
            try {
                produce({
                    event: 'user-authenticate',
                    data: req.user
                });
                if (user.team) {
                    produce({
                        code: user.team.code,
                        event: 'toggle-member-online',
                        data: null
                    });
                }
            } catch (err) {}
        } else {
            req.user = user;
        }
        return next();
    }

    debug('User not found, fetching profile');
    const source = await fetchAuth0Profile(accessToken);

    const fullName = source.name !== source.email ? source.name : '';
    const [firstName = '', lastName = ''] = fullName.split(' ');

    const profile = {
        email: source.email,
        firstName,
        lastName,
        active: false,
        online: true,
        doorOpen: true,
        lastLogin: Date.now(),
        machineID,
        appVersion,
        source
    };
    const newUser = await User.findOneAndUpdate(
        {
            email: source.email
        },
        { $set: profile },
        {
            upsert: true,
            setDefaultsOnInsert: true,
            new: true
        }
    ).populate('team', 'code');
    req.user = newUser;
    try {
        produce({
            event: 'user-authenticate',
            data: req.user
        });
    } catch (err) {}

    return next();
};

module.exports = { fetchAuth0Profile, userMiddleware };
