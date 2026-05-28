const {
    AppError,
    errorHandler,
    invalidUrlHandler,
    handleMongoDuplicateError,
    handleMongooseCastError,
    handleMongooseValidationError,
    sendErrorDev,
    sendErrorProd
} = require('./error');
const MockRes = require('./MockRes');

let res;

describe('Error handler for Express server', () => {
    const ACTUAL_ENV = process.env.NODE_ENV;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...ACTUAL_ENV };
        res = new MockRes();
    });
    afterEach(() => {
        process.env = ACTUAL_ENV;
        res = null;
    });
    test('AppError constructor creates instance of Error ', () => {
        const e = new AppError('test', 500);

        expect(e).toBeInstanceOf(Error);
    });
    test('AppError sets statusCode, message, status, and isOperational in constructor', () => {
        const msg = 'Test Error';
        const code = 500;
        const e = new AppError(msg, code);

        expect(e.message).toBe(msg);
        expect(e.statusCode).toBe(code);
        expect(e.status).toBe('error');
        expect(e.isOperational).toBe(true);
    });
    test('AppError sets status to fail if code starts with 4', () => {
        const e = new AppError('Not Found', 404);

        expect(e.status).toBe('fail');
    });
    test('invalidUrlHandler calls next', () => {
        const mockNext = jest.fn();
        invalidUrlHandler({ originalUrl: '/undefined' }, null, mockNext);

        expect(mockNext).toHaveBeenCalled();
    });
    test('sendErrorDev sets correct status and sends error object', () => {
        const mockErr = {
            status: 'fail',
            statusCode: 404,
            message: 'Not Found',
            stack: 'err @ line 7:52 in index.js'
        };

        sendErrorDev(mockErr, res);

        expect(res.sentStatus).toBe(mockErr.statusCode);
        expect(res.sent.message).toBe(mockErr.message);
        expect(res.sent.status).toBe(mockErr.status);
        expect(res.sent.error).toBe(mockErr);
        expect(res.sent.stack).toBe(mockErr.stack);
    });
    test('sendErrorProd sends real error message if error isOperational', () => {
        const mockErr = {
            isOperational: true,
            statusCode: 404,
            status: 'fail',
            message: 'Not Found'
        };

        sendErrorProd(mockErr, res);

        expect(res.sentStatus).toBe(mockErr.statusCode);
        expect(res.sent.message).toBe(mockErr.message);
    });
    test('sendErrorProd sends generic status code and error message if not operational', () => {
        const mockErr = {
            statusCode: 418,
            status: 'fail',
            message: `I'm a teapot`
        };

        sendErrorProd(mockErr, res);

        expect(res.sentStatus).toBe(500);
        expect(res.message).not.toBe(mockErr.message);
    });
    test('handleMongooseCastError returns AppError with custom message and 400 status', () => {
        const mockErr = {
            path: 'User._id',
            value: 'user1'
        };

        const e = handleMongooseCastError(mockErr);

        expect(e).toBeInstanceOf(AppError);
        expect(e.message).toBe(`Invalid ${mockErr.path}: ${mockErr.value}`);
        expect(e.statusCode).toBe(400);
    });
    test('handleMongoDuplicateError returns AppError with custom message and 400 status code', () => {
        const mockErr = {
            errmsg: `Duplicate entry:, "user.name"`
        };

        const e = handleMongoDuplicateError(mockErr);

        expect(e).toBeInstanceOf(AppError);
        expect(e.statusCode).toBe(400);
        expect(e.message).not.toBe(null);
    });
    test('handleMongooseValidationError returns AppError with custom message and 400 status code', () => {
        const mockErr = {
            errors: {
                err1: {
                    message: 'Email is required'
                },
                err2: { message: 'Name is required' }
            }
        };

        const e = handleMongooseValidationError(mockErr);

        expect(e).toBeInstanceOf(AppError);
        expect(e.statusCode).toBe(400);
        expect(e.message).toContain(mockErr.errors.err1.message);
        expect(e.message).toContain(mockErr.errors.err2.message);
    });
    test('errorHandler sends dev response when in dev', () => {
        process.env.NODE_ENV = 'development';
        const mockErr = {
            status: 'fail',
            statusCode: 404,
            message: 'Not Found',
            stack: 'mock stack'
        };

        errorHandler(mockErr, {}, res, {});

        expect(res.sent.stack).toBe(mockErr.stack);
    });
    test('errorHandler sets message for Mongoose CastError in prod', () => {
        process.env.NODE_ENV = 'production';
        const mockCastErr = {
            name: 'CastError',
            path: 'User._id',
            value: 'user1'
        };

        errorHandler(mockCastErr, {}, res, {});

        expect(res.sent.message).toBe(
            `Invalid ${mockCastErr.path}: ${mockCastErr.value}`
        );
    });
    test('errorHandler sets message for Mongo Duplicate error in prod when code is 11000', () => {
        process.env.NODE_ENV = 'production';
        const mockDupErr = {
            code: 11000,
            errmsg: `Duplicate entry:, "user.name"`
        };

        errorHandler(mockDupErr, {}, res, {});

        expect(res.sent.message).toContain('user.name');
    });
    test('errorHandler sets message for Mongoose ValidationError in prod', () => {
        process.env.NODE_ENV = 'production';
        const mockErr = {
            errors: {
                err1: {
                    message: 'Email is required'
                },
                err2: { message: 'Name is required' }
            },
            name: 'ValidationError'
        };

        errorHandler(mockErr, {}, res, {});

        expect(res.sentStatus).toBe(400);
        expect(res.sent.message).toContain(mockErr.errors.err1.message);
        expect(res.sent.message).toContain(mockErr.errors.err2.message);
    });
});
