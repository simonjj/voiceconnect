const debug = require('debug')('ttc:error-lib');
const { createLogger, format, transports } = require('winston');
const path = require('path');
const { logLevel } = require('kafkajs');

const errorLogger = createLogger({
    level: 'error',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.errors({ stack: true }),
        format.splat(),
        format.json()
    ),
    defaultMeta: { service: 'connect-server' },
    transports: [
        new transports.File({
            filename: path.resolve(__dirname, '../../logs/error.log')
        })
    ]
});

class AppError extends Error {
    constructor(message, statusCode) {
        super(message);

        this.statusCode = statusCode;
        this.status = String(statusCode).startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

function invalidUrlHandler(req, res, next) {
    next(new AppError(`Can't find ${req.originalUrl} on this server.`, 404));
}

function sendErrorDev(err, res) {
    const payload = {
        status: err.status,
        message: err.message,
        error: err,
        stack: err.stack
    };
    if (!res.headersSent) {
        res.status(err.statusCode);
        res.set('Content-Type', 'application/json');
    }
    debug(err.message, err.stack);

    res.json(payload);
}

function sendErrorProd(err, res) {
    // only send operational errors back to client in prod, otherwise log and send generic message
    if (err.isOperational) {
        res.status(err.statusCode).json({
            status: err.status,
            message: err.message
        });
    } else {
        debug('Server error', err);
        errorLogger.log('error', err);

        res.status(500).json({
            status: 'error',
            message: 'Something went wrong.'
        });
    }
}

function handleMongooseCastError(err) {
    const message = `Invalid ${err.path}: ${err.value}`;

    return new AppError(message, 400);
}

function handleMongoDuplicateError(err) {
    const value = err.errmsg.match(/(["'])(?:(?=(\\?))\2.)*?\1/)[0];
    const message = `Duplicate field value: ${value}. Please use another value!`;
    return new AppError(message, 400);
}

function handleMongooseValidationError(err) {
    const errors = Object.values(err.errors).map((e) => e.message);
    const message = `Invalid input data. ${errors.join('. ')}`;

    return new AppError(message, 400);
}

function handleUnauthorizedError(err) {
    const message = 'Invalid token';

    return new AppError(message, 401);
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(err, res);
    } else {
        let error = { ...err };

        if (error.name === 'UnauthorizedError') {
            error = handleUnauthorizedError(error);
        }
        if (error.name === 'CastError') {
            error = handleMongooseCastError(error);
        }
        if (error.code === 11000) {
            error = handleMongoDuplicateError(error);
        }
        if (error.name === 'ValidationError') {
            error = handleMongooseValidationError(error);
        }

        sendErrorProd(error, res);
    }
}

function KafkaLogCreator(level) {
    /*
        Following this pattern: https://kafka.js.org/docs/custom-logger
        We are only logging error level messages in other places so I'm reapeating that here.
    */
    if (level !== logLevel.ERROR || level !== logLevel.NOTHING) {
        // kafkajs docs recommended converting NOTHING level logs to errors
        return () => {};
    }
    return function logKafkaError({ log }) {
        const { message, ...rest } = log;

        errorLogger.log({
            level: 'error',
            message,
            rest
        });
    };
}

module.exports = {
    AppError,
    errorHandler,
    invalidUrlHandler,
    handleMongoDuplicateError,
    handleMongooseCastError,
    handleMongooseValidationError,
    KafkaLogCreator,
    sendErrorDev,
    sendErrorProd
};
