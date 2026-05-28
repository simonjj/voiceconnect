/* istanbul ignore file*/
const { Router } = require('express');
const body = require('body-parser');

const {
    createInvitations,
    getInvitations
    //removeInvitation
} = require('./handlers');

const router = new Router();
const json = body.json();

router.get('/invitations', getInvitations);
router.post('/invitation', json, createInvitations);
// router.delete('/invitation', removeInvitation);

module.exports = router;
