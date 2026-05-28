/* eslint-env node, jest */
const { defaults } = require('jest-config');
module.exports = {
    ...defaults,
    collectCoverageFrom: ['**/src/**/!(*.test).js'],
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: -10
        }
    },
    projects: [
        {
            ...defaults,
            displayName: 'Server',
            testEnvironment: 'node',
            testMatch: ['<rootDir>/src/**/*.test.js'],
            testPathIgnorePatterns: ['/node_modules/', '/data/', '/dist/'],
            watchPathIgnorePatterns: [
                '<rootDir>/node_modules/',
                '<rootDir>/data/'
            ]
        }
    ],
    preset: '@shelf/jest-mongodb'
};
