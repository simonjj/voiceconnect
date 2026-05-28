// maps keycodes to hotkeys lib key names.  reverse of this https://github.com/jaywcjlove/hotkeys/blob/master/src/var.js

let fKeys = {};
for (let k = 1; k < 20; k++) {
    fKeys[111 + k] = `f${k}`;
}

export const modKeys = {
    16: 'shift',
    18: 'alt',
    91: 'cmd',
    17: 'ctrl',
    20: 'capslock',
    9: 'tab',
    13: 'enter'
};

export default {
    8: 'backspace',
    9: 'tab',
    12: 'clear',
    27: 'esc',
    32: 'space',
    37: 'left',
    38: 'up',
    39: 'right',
    40: 'down',
    46: 'del',
    45: 'insert',
    36: 'home',
    35: 'end',
    33: 'pageup',
    34: 'pagedown',
    20: 'capslock',
    188: ',',
    190: '.',
    191: '/',
    192: '`',
    189: '-',
    187: '=',
    186: ';',
    222: "'",
    219: '[',
    221: ']',
    220: '\\',
    ...modKeys,
    ...fKeys
};
