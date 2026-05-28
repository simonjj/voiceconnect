const debug = require('debug')('ttc:main:calcWindowOrigin');
const { screen } = require('electron');
const { appStore } = require('../lib/MemoryStore');

function calcWindowOrigin(win, boundary = 64) {
    if (!win) return;

    const { saveRelativeBounds } = require('../lib/ipcHandlers');

    const { x, y, height, width } = win.getBounds();
    const horizontalSpan = x + width;
    const verticalSpan = y + height;
    const { workArea } = screen.getDisplayNearestPoint({ x: x, y: y });
    const {
        width: displayWidth,
        height: displayHeight,
        x: displayX,
        y: displayY
    } = workArea;
    const topBound = displayY + boundary;
    const rightBound = displayX + displayWidth - boundary;
    const bottomBound = displayY + displayHeight - boundary;
    const leftBound = displayX + boundary;
    let origin;

    if (horizontalSpan >= rightBound && verticalSpan >= bottomBound) {
        origin = 'bottom-right';
    } else if (horizontalSpan >= rightBound && y <= topBound) {
        origin = 'top-right';
    } else if (x <= leftBound && y <= topBound) {
        origin = 'top-left';
    } else if (x <= leftBound && verticalSpan >= bottomBound) {
        origin = 'bottom-left';
    } else if (x < leftBound) {
        origin = 'left';
    } else if (horizontalSpan > rightBound) {
        origin = 'right';
    } else if (y < topBound) {
        origin = 'top';
    } else if (verticalSpan > bottomBound) {
        origin = 'bottom';
    } else {
        origin = 'center';
    }

    appStore.setState({ windowOrigin: origin });
    saveRelativeBounds(null, {
        type: win.slug === 'primary' ? 'main' : 'tutorial'
    });
    debug('Display: ', screen.getDisplayNearestPoint({ x: x, y: y }));
    debug('Window Origin: ', appStore.get('windowOrigin'));
}

module.exports = calcWindowOrigin;
