const { systemPreferences } = require('electron');
const debug = require('debug')('ttc:main:media');

// Explicitly grant permission for user media on Mac
const getMediaPermissions = async () => {
    const micAccess = systemPreferences.getMediaAccessStatus('microphone');

    debug({ micAccess });
    if (micAccess !== 'granted') {
        try {
            await systemPreferences.askForMediaAccess('microphone');
        } catch (err) {
            console.log('Mic Error: ', err);
        }
    }
};

module.exports = {
    getMediaPermissions
};
