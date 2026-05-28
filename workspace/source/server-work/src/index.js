/* istanbul ignore file */
const config = require('config');
const debug = require('./lib/debug')('ttc:main');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const body = require('body-parser');

const { errorHandler, invalidUrlHandler } = require('./lib/error');
const jwtAuth = require('./lib/jwtAuth');
const { userMiddleware } = require('./lib/userMiddleware');
const { isLoggedIn } = require('./routes/users/handlers');
const { acceptInvitation } = require('./routes/invitations/handlers');

const {
    issuerBaseURL,
    clientID,
    redirect_uri,
    scope,
    apiIdentifier: audience
} = config.get('app.auth');

const accessLogStream = fs.createWriteStream(
    path.resolve(__dirname, '../logs/access.log'),
    { flags: 'a' }
);

// Constants
const PORT = process.env.NODE_PORT || 7000;

// Server and App
const app = express();
app.use(
    morgan('combined', {
        stream: accessLogStream
    })
);
app.use(helmet());
app.set('trust proxy', true);
app.use('/assets', express.static(path.join(__dirname, '../assets')));

app.get('/', (req, res) => {
    res.send('OK');
});

app.post('/request-test', body.json(), (req, res, next) => {
    debug(req.body);
    res.json({ message: 'OK' });
});
app.get('/request-test', (req, res, next) => {
    res.json({ message: 'OK' });
});

app.get('/invitation/confirm/:acceptanceCode', acceptInvitation);

app.get('/auth-redirect', (req, res) => {
    const query = url.parse(req.url, true).search;
    return res.redirect(`/redirect${query}`);
});

app.get('/redirect', (req, res) => {
    return res.sendFile(
        path.join(__dirname, '../assets/redirect-page/index.html')
    );
});

app.get('/download', (req, res) => {
    const { headers } = req;
    const platform = headers['user-agent'];

    const downloadBuild = (path) => {
        return res.redirect(
            `https://s3.amazonaws.com/connect-downloads/${path}`
        );
    };

    if (platform.match('Mac OS')) {
        return downloadBuild('connect-app-macos-latest.zip');
    }
    if (platform.match('Windows')) {
        return downloadBuild('connect-app-windows-latest.zip');
    }
    if (platform.match('Linux')) {
        return downloadBuild('connect-app-linux-latest-appimage.zip');
    }
});

app.get('/logout-redirect', (req, res) => {
    const url = new URL(issuerBaseURL);
    url.pathname = 'authorize';
    url.search = new URLSearchParams({
        audience,
        client_id: clientID,
        redirect_uri,
        scope,
        response_type: 'code'
    }).toString();

    return res.redirect(url.toString());
});

const server = http.createServer(app);

(async function __MAIN__() {
    if (config.has('database')) {
        const database = require('./lib/database');
        await database.connect();
    }
    if (config.has('kafka')) {
        const kafka = require('./lib/kafka');
        await kafka.connect();
    }

    //Routes
    const routes = require('./routes');

    app.use(jwtAuth);
    app.get('/isLoggedIn', isLoggedIn);
    app.use(userMiddleware);
    app.use(routes);
    app.all('*', invalidUrlHandler);
    app.use(errorHandler);

    await server.listen(PORT);
    debug('Listening on %s', server.address().port);
})();
