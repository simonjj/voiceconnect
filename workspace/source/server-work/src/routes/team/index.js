/* istanbul ignore file*/
const { Router } = require('express');
const body = require('body-parser');

const {
    teams,
    create,
    setAdmin,
    unsetAdmin,
    updateOwner,
    inviteMember,
    updatePrivacyState,
    removeMember,
    removeTeam,
    join,
    leave
} = require('./handlers');

const catchAsync = require('../../lib/catchAsync');

const router = new Router();
const json = body.json();

router.get('/teams', catchAsync(teams));
router.post('/teams', json, catchAsync(create));
router.put('/team/:code/admin/set', json, setAdmin);
router.put('/team/:code/admin/unset', json, unsetAdmin);
router.put('/team/:code/owner/update', json, updateOwner);
router.put('/team/:code/membership/invite', json, inviteMember);
router.put('/team/:code/privacy/:state', json, updatePrivacyState);
router.delete('/team/:code/membership/remove', json, removeMember);
router.delete('/teams/:code', removeTeam);
router.put('/team/:code/membership', join);
router.delete('/team/:code/membership', catchAsync(leave));

module.exports = router;
