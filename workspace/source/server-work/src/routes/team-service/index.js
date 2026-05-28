/* istanbul ignore file*/
const { Router } = require('express');
const router = new Router();

const { requiresServiceCall } = require('../../lib/service-call.js');

const TeamService = require('../../lib/TeamService');
const catchAsync = require('../../lib/catchAsync');

const Team = require('../../models/Team');
const filter = ':code([a-z0-9]{24}|[a-z0-9_-]{7,})';
const teamServiceRoutes = require('./routes.js');
const { v4: uuid } = require('uuid');

(async () => {
    const teamservice = await TeamService();
    router.get(
        [`/team-service/${filter}`, '/team-service'],
        catchAsync(async (req, res, next) => {
            if (req.headers.accept === 'text/event-stream') {
                if (
                    !req.user.team ||
                    (req.params.code && req.user.team.code !== req.params.code)
                ) {
                    return res.sendStatus(403);
                }
                const code = req.params.code || req.user.team.code;
                const criteria = code.length === 24 ? { _id: code } : { code };

                req.user.set('online', true);
                await req.user.save();

                req.id = uuid();
                req.team = await Team.findOne(criteria);
                if (req.team == null) return res.sendStatus(403);
                res.set({
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'X-Accel-Buffering': 'no'
                });

                if (req.query.silent) {
                    res.silent = true;
                }
                next();
            } else next('route');
        }),
        teamservice
    );
    router.use('/team-service', requiresServiceCall(), teamServiceRoutes);
})();

module.exports = router;
