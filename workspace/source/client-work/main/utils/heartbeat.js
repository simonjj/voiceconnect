const checkNetwork = require('./checkNetwork');
const debug = require('debug')('ttc:main:heartbeat');
const request = require('./request');
const { BrowserWindow } = require('electron');
const { HEARTBEAT_FAILURE } = require('../../shared/constants');

let onLine = true;
let heartbeatInterval = 10000;
let timer;

let lastSuccess = +Date.now();
const timeout = { response: 2000 };

function getPrimaryWindow() {
    return BrowserWindow.getAllWindows().find((w) => w.tag === 'primary');
}

async function heartbeat() {
    clearTimeout(timer);
    const iteration = +Date.now();
    let res;
    try {
        res = await checkNetwork(
            () => request.timeout(timeout).get('/heartbeat'),
            80,
            3
        );
        if (res.ok) {
            const { body } = res;
            heartbeatInterval = body.heartbeatInterval;

            timer = setTimeout(heartbeat, heartbeatInterval);

            if (iteration - lastSuccess > heartbeatInterval * 4 || !onLine) {
                let win = getPrimaryWindow();
                if (win) win.reload();
                win = null;
                onLine = true;
            }
            lastSuccess = iteration;
        }
    } catch (err) {
        debug({ res, err });
        timer = setTimeout(heartbeat, heartbeatInterval);
        onLine = false;
        let win = getPrimaryWindow();
        if (win) {
            win.webContents.send(HEARTBEAT_FAILURE);
            win = null;
        }
    }
}
heartbeat.restart = () => {
    onLine = false;
    clearTimeout(timer);
    heartbeat();
};

module.exports = heartbeat;
