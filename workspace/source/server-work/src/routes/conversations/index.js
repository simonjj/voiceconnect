/* istanbul ignore file*/
const debug = require('debug')('ttc:conversations');
const { Router } = require('express');
const body = require('body-parser');

const {
    produceConversationChange,
    getConversationsByTeam,
    createConversation,
    userLeaveConversations,
    userConversationPrivate,
    acceptKnock,
    declineKnock,
    removeUserFromConversation
} = require('./handlers');
const catchAsync = require('../../lib/catchAsync');

const router = new Router();
const json = body.json();

router.get('/conversations', catchAsync(getConversationsByTeam));
router.get(
    '/conversations-update',
    (req, res, next) => {
        res.dirty = true;
        res.end('OK');
        next();
    },
    catchAsync(produceConversationChange)
);
router.use(
    [
        '/conversation',
        '/conversations',
        '/knock/accept',
        '/:conversationId/disconnect'
    ],
    (req, res, next) => {
        res.dirty = true;
        res.once('finish', () => produceConversationChange(req, res));
        next();
    }
);

router.post('/conversations', json, catchAsync(createConversation));
router.post('/conversations/leave', json, catchAsync(userLeaveConversations));
router.put('/conversation/private', catchAsync(userConversationPrivate));
router.post('/knock/accept', acceptKnock);
router.post('/knock/decline', declineKnock);
router.delete(
    '/:conversationId/disconnect',
    json,
    catchAsync(removeUserFromConversation)
);

module.exports = router;
