const ua = require('universal-analytics');
const { app } = require('electron');
const { v4 } = require('uuid');
const { JSONStorage } = require('node-localstorage');
const nodeStorage = new JSONStorage(app.getPath('userData'));

// Retrieve the userid value, and if it's not there, assign it a new uuid.
const userId = nodeStorage.getItem('userid') || v4();

const usr = ua('UA-180675474-2', userId);
// (re)save the userid, so it persists for the next app session.
nodeStorage.setItem('userid', userId);

function trackEvent(category, action, label, value) {
    usr.event({
        ec: category,
        ea: action,
        el: label,
        ev: value
    }).send();
}

module.exports = { trackEvent };
