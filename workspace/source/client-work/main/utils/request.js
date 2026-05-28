const superagent = require('superagent');
const request = { ...superagent };

const { net, session } = require('electron');
const { apiBaseURL } = require('config').get('app');

const prepareOptions = (options) => ({
    ...(typeof options === 'object' ? options : undefined),
    pathname: options.path && options.path,
    session: session.defaultSession
});

const _request = function(protocol, options, cb) {
    options = prepareOptions(options);
    const url = new URL(!options.host ? apiBaseURL : 'http://voiceconnect');
    for (const key in options) {
        url[key] = options[key];
    }
    url.protocol = protocol;
    const req = net.request(
        {
            url: url.toString('utf8'),
            ...options
        },
        cb
    );

    // Electron API uses chromium http, which handles encoding
    req.once('response', (res) => {
        for (const index in res._responseHead.rawHeaders) {
            const lookup = res._responseHead.rawHeaders[index].key;
            if (lookup === 'content-encoding') {
                res._responseHead.rawHeaders[index].value = 'utf-8';
            }
        }
    });
    req._setHeader = req.setHeader;

    // Electron API is broken
    req.setHeader = (name, value) => {
        if (name.toLowerCase() !== 'content-length')
            req._setHeader(name, value);
    };
    req.setNoDelay = () => {};

    return req;
};

if (process.versions && !!process.versions.electron) {
    request.protocols['http:'] = { request: _request.bind(null, 'http:') };
    request.protocols['https:'] = { request: _request.bind(null, 'https:') };
}

const agent = request.agent();

const baseUrl = () => {
    return function(request) {
        if (request.url[0] === '/')
            request.url = `${apiBaseURL}/${request.url.substr(1)}`;
        return request;
    };
};

agent.use(baseUrl());

module.exports = agent;
