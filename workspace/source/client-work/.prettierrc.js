const defaults = require('@touchto/dev-config');

module.exports = {
    ...defaults,
    overrides: [
        ...defaults.overrides,
        {
            files: '*.yml',
            options: {
                tabWidth: 2
            }
        }
    ]
};
