/* eslint-env node, jest */
module.exports = {
    collectCoverageFrom: [
        '<rootDir>/renderer/**/!(*.test).js',
        '!<rootDir>/renderer/dist/**/*.js',
        '!<rootDir>/renderer/webpack/**/*.js'
    ],
    /*
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: -10
        }
    },
    */
    projects: [
        {
            displayName: 'Client',
            testEnvironment: 'jsdom',
            testMatch: ['<rootDir>/renderer/**/*.test.js'],
            setupFiles: ['<rootDir>/tests/setupClient.js'],
            setupFilesAfterEnv: ['<rootDir>/tests/setupClientTests.js'],
            moduleNameMapper: {
                '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga|css)$':
                    '<rootDir>/tests/__mocks__/fileMock.js'
            },
            testPathIgnorePatterns: ['/node_modules/', '/data/', '/dist/'],
            watchPathIgnorePatterns: [
                '<rootDir>/node_modules/',
                '<rootDir>/data/'
            ]
        },
        {
            displayName: 'Electron',
            testEnvironment: 'node',
            testMatch: ['<rootDir>/main/**/*.test.js'],
            testPathIgnorePatterns: ['/node_modules/', '/data/', '/dist/'],
            watchPathIgnorePatterns: [
                '<rootDir>/node_modules/',
                '<rootDir>/data/'
            ]
        }
    ]
};
