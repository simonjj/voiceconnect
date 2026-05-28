/* istanbul ignore file */
const express = require('express');

const router = new express();
router.set('etag', false);

router.use(require('./assets'));
router.use(require('./users'));
router.use(require('./team'));
router.use(require('./team-service'));
router.use(require('./conversations'));
router.use(require('./heartbeat'));
router.use(require('./invitations'));

module.exports = router;
