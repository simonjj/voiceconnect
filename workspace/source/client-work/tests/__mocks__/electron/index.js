module.exports = {
    app: {
        getPath: jest.fn()
    },
    remote: {
        require: () => ({
            getAccessToken: jest.fn(),
            getProfile: jest.fn()
        })
    }
};
