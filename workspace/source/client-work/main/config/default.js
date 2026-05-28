/* eslint-disable camelcase */
module.exports = {
    app: {
        name: 'Connect',
        auth: {
            inAppAuth: false,
            keyname_base: 'VoiceConnect',
            apiIdentifier: 'connect-server',
            baseURL: 'https://localhost',
            client_id: 'BzlwKqW1WvZU2FquUcf7ddVYPl2XEjjB',
            issuerBaseURL: 'voiceconnect.us.auth0.com',
            redirect_uri: 'http://localhost/callback',
            scope: 'openid profile email offline_access',
            secret: 'Touch To Rocks!'
        },
        verifiedProtocol: 'connect://',
        apiBaseURL: 'https://launch.getteamconnect.app',
        helpURL: 'https://getteamconnect.app/help/',
        peerConfig: {
            iceServers: [
                { urls: ['stun:stun.touchto.io'] },
                {
                    urls: ['turn:turn.touchto.io'],
                    username: 'testy',
                    credential: 'man2020',
                    maxRateKbps: '8000'
                }
            ],
            iceTransportPolicy: 'all'
        }
    }
};
