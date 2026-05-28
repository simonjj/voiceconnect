module.exports = {
    app: {
        name: 'Touch To CONNECT',
        key: 'ttc',
        auth: {
            apiIdentifier: 'connect-server',
            baseURL: 'https://localhost',
            redirect_uri: 'https://launch.getteamconnect.app/auth-redirect',
            routes: false,
            rulesNamespace: 'https://getteamconnectapp/',
            scope: 'openid profile email offline_access'
        },
        invitationURL: 'https://getteamconnect.app/',
        heartbeat: {
            interval: 10000,
            iterationsBeforeLogoff: 4
        }
    },
    database: {
        connect: 'mongodb://mongo/connect'
    },
    kafka: {
        clientId: 'connect-server',
        topic: 'TEAM_SERVICE',
        brokers: ['kafka:9092']
    }
};
