/**
 * @module routes/users/handlers
 */
// eslint-disable-next-line no-unused-vars
const express = require('express');
const jwtDecode = require('jwt-decode');
const config = require('config');

const User = require('../../models/User');
const Team = require('../../models/Team');
const { produce } = require('../../lib/kafka');
const { muteUser, unmuteUser } = require('../../lib/mute');

const { rulesNamespace } = config.get('app.auth');

/**
 * Sends user profile from mongo, requires auth
 * Route: /profile
 * Method: GET
 * @memberof module:routes/users/handlers
 * @function getProfile
 * @param {express.Request} req
 * @param  {express.Response} res
 */
const getProfile = async (req, res) => {
    const { isLaunch } = req.params;
    if (JSON.parse(isLaunch)) {
        const doorByDefault =
            req.user.defaultDoor !== null ? req.user.defaultDoor : true;
        req.user.set('doorOpen', doorByDefault);
        await req.user.save();
    }
    res.json(req.user);
};

const goOffline = async (req, res) => {
    req.user.set({
        online: false
    });
    await req.user.save();
    if (req.user.team) {
        const {
            team: { code }
        } = req.user;

        const data = req.user;

        await produce({
            code,
            event: 'user-offline',
            data
        });
    }
    res.end('OK');
};

/**
 * sets user profile to offline
 * Route: /logout
 * Method: GET
 * @memberof module:routes/users/handlers
 * @function logout
 * @param {express.Request} req
 * @param  {express.Response} res
 */
const logout = async (req, res) => {
    req.user.set({
        muted: false,
        doorOpen: true,
        online: false
    });

    await req.user.save();
    res.send('OK');

    try {
        produce({
            event: 'user-quit',
            data: req.user
        });
    } catch (err) {}
};

/**
 * Sends the authenticated user team list
 * Route: /team
 * Method: GET
 * @memberof module:routes/users/handlers
 * @function getTeam
 * @param {express.Request} req
 * @param {express.Response} res
 */
const getTeam = async (req, res) => {
    const team = await Team.findById(req.user.team).populate(
        'members',
        'email door muted online initials code lastLogin'
    );
    if (team) {
        team.members = team.members.filter(
            (m) => m._id.toString() !== req.user._id.toString()
        );
    }
    res.json(team);
};

const setDoorState = async (user, doorOpen) => {
    try {
        user.set('doorOpen', doorOpen);
        await user.save();

        /* istanbul ignore else */
        if (user.team) {
            const {
                team: { code }
            } = user;

            const data = {
                _id: user.id,
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                defaultInitials: user.defaultInitials,
                avatarColor: user.avatarColor,
                doorOpen: doorOpen,
                firstVisit: user.firstVisit,
                online: user.online,
                initials: user.initials,
                code: user.code,
                lastLogin: user.lastLogin,
                isKnockRequired: user.isKnockRequired
            };

            produce({
                code,
                event: 'door-state',
                data
            });
        }
    } catch (e) {
        console.log(e.message);
    }
};

const updateDoorState = async (req, res) => {
    try {
        const { state } = req.params;
        const user = await User.findById(req.user._id).populate('team', 'code');

        const newDoorState = JSON.parse(state);

        if (newDoorState === user.get('doorOpen')) return res.end('OK');

        await setDoorState(user, newDoorState);

        res.end('OK');
    } catch (error) {
        return res.status(400).json({
            error: 'something_went_wrong',
            message: error.message
        });
        console.log(error);
    }
};

const updateMutedState = async (req, res) => {
    const { state } = req.params;
    const { user } = req;

    const muted = state.trim().toLowerCase() === 'mute';
    if (muted) {
        await muteUser(user._id);
    } else {
        await unmuteUser(user._id);
    }

    res.end('OK');
};

const changeFirstVisit = async (req, res) => {
    const { user } = req;

    const selectedUser = await User.findById(user._id).populate('team', 'code');
    selectedUser.set('firstVisit', false);

    await selectedUser.save();
    res.end('OK');
};

/**
 * Updates user profile with values given in body object.
 * Sends updated user profile
 * Route /profile
 * Method: PUT
 * @memberof module:routes/users/handlers
 * @function updateProfile
 * @param {express.Request} req
 * @param {Object} req.body Object containing updates to User model
 * @param  {express.Response} res
 */
const updateProfile = async (req, res) => {
    const criteria = {
        _id: req.user._id
    };

    const user = await User.findOneAndUpdate(
        criteria,
        { ...req.body },
        { new: true }
    ).populate('team');

    if (user.team) {
        const {
            team: { code }
        } = user;

        const data = {
            _id: user.id,
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            defaultInitials: user.defaultInitials,
            avatarColor: user.avatarColor,
            firstVisit: user.firstVisit,
            doorOpen: user.doorOpen,
            online: user.online,
            initials: user.initials,
            code: user.code,
            lastLogin: user.lastLogin,
            isKnockRequired: user.isKnockRequired
        };

        produce({
            code,
            event: 'profile-update',
            data
        });
    }

    res.json(user);
};

/**
 * Allows a user to search for other users within their org. Returns matches on initials, email, phoneNumber, and department
 * This will most likely be handled by ElasticSearch in the future
 * Sends a list of search results
 * Route: /search/:searchString
 * Method: GET
 * @memberof module:routes/users/handlers
 * @function searchUsers
 * @param {express.Request} req
 * @params {String} req.params.searchString The search term
 * @param  {express.Response} res
 */
const searchUsers = async (req, res) => {
    const { searchString } = req.params;
    const { orgCompany } = req.user;

    const searchRegex = {
        $regex: `^${searchString}`,
        $options: 'i'
    };

    const searchableFields = ['initials', 'email', 'phoneNumber', 'department'];
    const orCriteria = searchableFields.map((f) => ({ [f]: searchRegex }));

    const results = await User.find({
        $or: orCriteria,
        orgCompany
    }).exec();

    res.json(results);
};

/**
 * Checks to see if a user is already logged in/online so we don't have duplicate users
 * Route: /is-logged-in
 * Method: GET
 * @function isLoggedIn
 * @param {express.Request} req
 * @param  {express.Response} res
 */
const isLoggedIn = async (req, res) => {
    const [, accessToken] = req.headers.authorization.split(' ');
    const machineID = req.headers['x-machine-id'];
    const decoded = jwtDecode(accessToken);
    const email = decoded[`${rulesNamespace}email`];
    const user = await User.findOne({ email }).populate('team', 'code');
    if (user && user.team) {
        const deviceConflict = user.online && user.machineID !== machineID;
        if (deviceConflict) {
            produce({
                code: user.team.code,
                event: 'device-conflict',
                data: {
                    user: user._id
                }
            });
        }
        return res.json({ deviceConflict });
    } else res.json({ deviceConflict: false });
};

const onInstanceChosen = async (req, res) => {
    const machineID = req.headers['x-machine-id'];
    if (machineID) {
        req.user.set('machineID', machineID);
        await req.user.save();
        res.end();

        produce({
            code: req.user.team.code,
            event: 'instance-chosen',
            data: {
                user: req.user._id,
                machineID: machineID
            }
        });
    }
};

const onInstanceQuit = async (req, res) => {
    const machineID = req.headers['x-machine-id'];
    if (machineID) {
        res.end();
        produce({
            code: req.user.team.code,
            event: 'instance-quit',
            data: {
                user: req.user._id,
                machineID: machineID
            }
        });
    }
};

module.exports = {
    getProfile,
    goOffline,
    logout,
    getTeam,
    updateDoorState,
    updateMutedState,
    updateProfile,
    searchUsers,
    isLoggedIn,
    onInstanceChosen,
    onInstanceQuit,
    changeFirstVisit
};
