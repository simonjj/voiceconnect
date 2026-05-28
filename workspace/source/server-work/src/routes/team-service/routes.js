/* istanbul ignore file*/

const express = require('express');
const body = require('body-parser');

const Team = require('../../models/Team');
const catchAsync = require('../../lib/catchAsync');
const { produce } = require('../../lib/kafka');
const router = new express.Router();

const json = body.json();
const objectidCode = /([a-z0-9]{24}|[a-z0-9_-]{7,})/i;

router.get(
    objectidCode,
    catchAsync(async (req, res) => {
        const lookup = req.params[0];
        const criteria =
            lookup.length === 24 ? { _id: lookup } : { code: lookup };
        const team = await Team.findOne(criteria);
        res.json(team);
    })
);
router.get(
    '/',
    catchAsync(async (req, res) => {
        const teams = await Team.find({});
        res.json(teams);
    })
);

router.post(
    '/',
    json,
    catchAsync(async (req, res) => {
        try {
            const team = await new Team({
                ...req.body
            }).save();
            res.json(team);
        } catch (err) {
            res.status(422).send(err.message);
        }
    })
);

const filter = ':code([a-z0-9]{24}|[a-z0-9_-]{7,})';
router.post(
    `/broadcast/${filter}/:event`,
    json,
    catchAsync(async (req, res) => {
        const { code, event } = req.params;
        const data = {
            src: req.user._id,
            ...req.body
        };

        try {
            await produce({ code, event, data });
        } catch (err) {
            console.error(err);
        }
        res.end('OK');
    })
);

router.post(
    `/broadcast/:event`,
    json,
    catchAsync(async (req, res) => {
        const { event } = req.params;
        const { code } = req.user && req.user.team;

        if (!code) return res.sendStatus(403);

        const data = {
            src: req.user._id,
            ...req.body
        };

        try {
            await produce({ code, event, data });
        } catch (err) {
            console.error(err);
        }
        res.end('OK');
    })
);

router.put(
    objectidCode,
    json,
    catchAsync(async (req, res) => {
        const lookup = req.params[0];
        const criteria =
            lookup.length === 24 ? { _id: lookup } : { code: lookup };
        delete req.body.creator;
        const team = await Team.findOneAndUpdate(
            criteria,
            { ...req.body },
            { new: true }
        );
        res.json(team);
    })
);

router.delete(
    objectidCode,
    json,
    catchAsync(async (req, res) => {
        const lookup = req.params[0];
        const criteria =
            lookup.length === 24 ? { _id: lookup } : { code: lookup };
        await Team.findOneAndDelete(criteria);
        res.status(204).end();
    })
);

module.exports = router;
