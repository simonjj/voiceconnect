/* istanbul ignore file */

const jwt = require('express-jwt');
const jwkRsa = require('jwks-rsa');
const config = require('config');

const { apiIdentifier, issuerBaseURL } = config.get('app.auth');

const jwtAuth = jwt({
    secret: jwkRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${issuerBaseURL}.well-known/jwks.json`
    }),
    audience: apiIdentifier,
    issuer: issuerBaseURL,
    algorithms: ['RS256']
});

module.exports = jwtAuth;
