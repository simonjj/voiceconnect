/* istanbul ignore file */
const { app } = require('electron');
const path = require('path');
const { readFileSync, writeFileSync } = require('fs');
const { writeFile } = require('fs').promises;
const { EventEmitter } = require('events');

const { TF_EXAMPLES } = require('../../shared/constants');
const parseDotNotation = require('../utils/parseDotNotation');

class Store extends EventEmitter {
    constructor(opts) {
        super(opts);
        if (!opts.defaults || !opts.schema) {
            throw new Error('Defaults and Joi schema required for Store');
        }
        const userDataPath = app.getPath('userData');

        this.path = path.join(userDataPath, opts.configName + '.json');
        this.data = parseDataFile(this.path, opts.defaults, opts.schema);
        this.emit('ready', this);
    }

    get(key) {
        const val = parseDotNotation(key, this.data);

        if (isTfExample(key) && val) {
            return stringToBuffer(val);
        }

        return val;
    }

    async set(key, val) {
        if (isTfExample(key)) {
            val = bufferToString(val);
        }

        this.data[key] = val;

        return await writeFile(this.path, JSON.stringify(this.data));
    }
}

function bufferToString(arrayBuffer) {
    return JSON.stringify(Array.from(new Uint8Array(arrayBuffer)));
}

function stringToBuffer(stringifiedBuffer) {
    return new Uint8Array(JSON.parse(stringifiedBuffer)).buffer;
}

function isTfExample(key) {
    return key.includes(TF_EXAMPLES);
}

function parseDataFile(filePath, defaults, schema) {
    let data = {};
    try {
        const datafile = readFileSync(filePath);
        const datares = JSON.parse(datafile);

        const { value } = schema.validate(datares);
        if (value.error) throw new Error(value.error);
        else data = { ...data, ...value };
    } catch (error) {
        data = { ...defaults, ...data };
    } finally {
        Object.entries(defaults).forEach(([key, value]) => {
            if (!data.hasOwnProperty(key)) {
                data[key] = value;
            }
        });
        writeFileSync(filePath, JSON.stringify(data));

        return data;
    }
}

module.exports = Store;
