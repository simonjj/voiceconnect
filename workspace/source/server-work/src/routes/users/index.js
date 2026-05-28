/* istanbul ignore file*/
const { Router } = require('express');
const body = require('body-parser');

const {
    getProfile,
    goOffline,
    logout,
    getTeam,
    updateDoorState,
    updateMutedState,
    updateProfile,
    onInstanceChosen,
    onInstanceQuit,
    searchUsers,
    changeFirstVisit
} = require('./handlers');
const catchAsync = require('../../lib/catchAsync');

const router = new Router();
const json = body.json();

router.get('/profile/:isLaunch', getProfile);
router.put('/offline', goOffline);
router.get('/logout', logout);
router.get('/team', getTeam);
router.put('/door/:state', updateDoorState);
router.put('/muted/:state', updateMutedState);
router.put('/profile', json, catchAsync(updateProfile));
router.post('/instance-chosen', catchAsync(onInstanceChosen));
router.post('/instance-quit', catchAsync(onInstanceQuit));
router.get('/search/:searchString', catchAsync(searchUsers));
router.post('/first-visit', catchAsync(changeFirstVisit));

module.exports = router;
