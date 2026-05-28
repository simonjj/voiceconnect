const isServiceCall = (accepts = ['application/json', 'text/event-stream']) => {
    const check = new RegExp(accepts.join('|'), 'i');
    return (req, res, next) => {
        const headers = {
            accept: '',
            ...req.headers
        };

        if (req.xhr || check.test(headers.accept)) {
            req.isServiceCall = true;
        } else req.isServiceCall = false;
        next();
    };
};

const requiresServiceCall = (skipType = 'router', accepts = undefined) => {
    return [
        isServiceCall(accepts),
        (req, res, next) => {
            if (req.isServiceCall) next();
            else next(skipType);
        }
    ];
};

module.exports = {
    isServiceCall,
    requiresServiceCall
};
