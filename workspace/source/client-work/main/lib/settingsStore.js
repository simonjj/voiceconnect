const config = require('config');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');

const Store = require('./store');

const { username: account } =
    (config.app.auth.username && config.app.auth) || require('os').userInfo();

const { HOTKEY_CMDS } = require('../../shared/constants');

const defaults = {
    preferredMedia: {
        input: 'default',
        output: 'default'
    },
    hotkeys: {
        [HOTKEY_CMDS.CLOSE_DOOR]: 'ctrl+shift+c',
        [HOTKEY_CMDS.OPEN_DOOR]: 'ctrl+shift+o',
        [HOTKEY_CMDS.END]: 'ctrl+shift+e'
    },
    bounds: {
        width: 300,
        height: 300
    },
    backgroundConversationVolume: 50,
    onboard: true,
    origin: 'center',
    relativeBounds: {
        x: 0.5,
        y: 0.5
    },
    volumeSettings: {},
    machineID: uuidv4()
};

const hotkeysSchemaObject = Object.entries(defaults.hotkeys).reduce(
    (o, [key, value]) => ({
        ...o,
        [key]: Joi.string().default(value)
    }),
    {}
);

const schema = Joi.object({
    backgroundConversationVolume: Joi.number()
        .required()
        .default(50),
    preferredMedia: {
        input: Joi.string(),
        output: Joi.string()
    },
    hotkeys: Joi.object(hotkeysSchemaObject).required(),
    bounds: Joi.object({
        width: Joi.number().required(),
        height: Joi.number().required()
    }).required(),
    volumeSettings: Joi.object(),
    machineID: Joi.string()
        .required()
        .default(uuidv4())
});

const suffix = [account, process.env.NODE_APP_INSTANCE].join('-');

const store = new Store({
    configName: `settings-${suffix}`,
    defaults,
    schema
});

module.exports = store;
