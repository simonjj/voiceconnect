const isNetworkError = (err) =>
    err.message === 'net::ERR_INTERNET_DISCONNECTED' || err.status === 404;

module.exports = isNetworkError;
