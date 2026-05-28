function parseDotNotation(path, obj = {}) {
    const keys = path.split('.');
    let currentVal = obj;
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const hasKey = Object.prototype.hasOwnProperty.call(currentVal, key);
        if (!hasKey) {
            if (
                Object.prototype.toString.call(currentVal) === '[object Object]'
            ) {
                return undefined;
            } else {
                throw `Invalid key: ${key} in ${path}`;
            }
        }
        if (i === keys.length - 1) {
            return currentVal[key];
        } else {
            currentVal = currentVal[key];
        }
    }
}

module.exports = parseDotNotation;
