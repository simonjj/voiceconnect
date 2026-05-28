/* istanbul ignore file */
const config = require('config');
const debug = require('./debug')('ttc:database');
const mongoose = require('mongoose');

const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true,
    ...(config.has('database.options') ? config.database.options : {})
};

let reconnectTimeout;
let mongoRetries = 10;
const mongoRetryIntervalMs = 15000;

const reconnect = async function() {
    clearTimeout(reconnectTimeout);
    if (mongoRetries > 0 && mongoose.connection.readyState === 0) {
        await mongoose.connect(
            config.database.connect,
            options,
            (err) =>
                err &&
                console.error(
                    `Failed to connect, will rety ${mongoRetries} more times: ${err}`
                )
        );
        mongoRetries--;
        reconnectTimeout = setTimeout(reconnect, mongoRetryIntervalMs);
    }
};

mongoose.connection
    .on('connected', () => {
        debug('Connected to mongodb');
        mongoRetries = 10;
        clearTimeout(reconnectTimeout);
    })
    .on('disconnected', () => {
        console.error('Disconnected from mongodb, will attempt to reconnect');
        reconnectTimeout = setTimeout(reconnect, mongoRetryIntervalMs);
    })
    .on('close', () => {
        console.error('Connection to mongodb closed');
    })
    .on('error', (err) => {
        console.error(err);
    });

module.exports = {
    connection: mongoose.connection,
    connect: async function() {
        try {
            await mongoose.connect(config.database.connect, options);
        } catch (err) {
            console.error(err);
        }
    }
};
