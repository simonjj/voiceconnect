function reportError() {
    return Promise.resolve({ success: true });
}

module.exports = { reportError: reportError };
