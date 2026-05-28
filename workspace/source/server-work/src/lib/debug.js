/* istanbul ignore file */
const init = (key) => {
    let debug;
    try {
        debug = require('debug')(key);
    } catch (err) {
        debug = (...args) => console.log(...args);
    }
    return debug;
};

module.exports = init;
