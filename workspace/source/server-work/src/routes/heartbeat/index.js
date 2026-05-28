const express = require('express');
const config = require('config');

const { produce } = require('../../lib/kafka');
const { leaveConversations } = require('../conversations/handlers');

const router = new express.Router();

const { interval, iterationsBeforeLogoff } = config.get('app.heartbeat');

const logOffTimeoutMap = new Map();

const handleHeartbeat = async (req, res) => {
    try {
        const {
            user: {
                team: { code }
            },
            user
        } = req;

        const id = String(user._id);

        const previousTimeout = logOffTimeoutMap.get(id);

        if (previousTimeout) {
            clearTimeout(previousTimeout);
        }

        async function logOff() {
            logOffTimeoutMap.delete(id);
            if (user.online) {
                user.set('online', false);
                await user.save();

                await produce({
                    code,
                    event: 'user-offline',
                    data: user
                });
            }
        }
        const timeout = setTimeout(logOff, interval * iterationsBeforeLogoff);
        logOffTimeoutMap.set(id, timeout);
    } catch (err) {
    } finally {
        res.json({ heartbeatInterval: interval });
    }
};

router.get('/heartbeat', handleHeartbeat);

module.exports = router;
