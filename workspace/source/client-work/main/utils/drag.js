const { ipcMain, screen } = require('electron');
const calcWindowOrigin = require('./calcWindowOrigin');

function registerDrag(win, startName, endName) {
    let moveTimer = null;
    let dragging = false;
    const { width, height } = win.getBounds();

    win.on('move', () => {
        clearTimeout(moveTimer);
        moveTimer = setTimeout(calcWindowOrigin, 100, win);
    });

    const mouse = new Map([
        ['point', { x: 0, y: 0 }],
        ['client', { x: 0, y: 0 }]
    ]);

    const getMousePoint = () => {
        const { x, y } = screen.getCursorScreenPoint();
        mouse.set('point', { x, y });

        const point = mouse.get('point');
        const client = mouse.get('client');

        if (win && dragging) {
            try {
                win.setBounds({
                    width,
                    height,
                    x: Math.floor(point.x - client.x),
                    y: Math.floor(point.y - client.y)
                });
                setImmediate(getMousePoint);
            } catch (err) {
                console.error(err);
            }
        }
    };

    ipcMain.handle(endName, () => {
        dragging = false;
    });
    ipcMain.handle(startName, (e, { clientX, clientY }) => {
        dragging = true;
        mouse.set('client', { x: clientX, y: clientY });
        getMousePoint();
    });
}

function unregisterDrag(events) {
    events.forEach((event) => {
        ipcMain.removeHandler(event);
    });
}

module.exports = { registerDrag, unregisterDrag };
