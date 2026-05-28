const { screen } = require('electron');

const { getPrimaryWindow } = require('../../windows/primary');
const settingsStore = require('../settingsStore');
const { setRelativeBounds } = require('../browserWindow');

function getOrigin() {
    return settingsStore.get('origin');
}

function setOrigin(_, data) {
    const win = getPrimaryWindow();
    const relativeBounds = settingsStore.get('relativeBounds');
    const { x, y, width } = win.getBounds();
    const { x: relativeX, y: relativeY } = relativeBounds;
    const size = data && data.size ? data.size : width;
    const { workArea } = screen.getDisplayNearestPoint({ x: x, y: y });
    let transformedX;
    let transformedY;

    if (relativeX >= 0.75 && relativeY >= 0.75) {
        settingsStore.set('origin', 'bottom-right');
        transformedX = workArea.width - size;
        transformedY = workArea.height - size;
    } else if (relativeX >= 0.75 && relativeY <= 0.25) {
        settingsStore.set('origin', 'top-right');
        transformedX = workArea.width - size;
        transformedY = workArea.y;
    } else if (relativeX <= 0.25 && relativeY <= 0.25) {
        settingsStore.set('origin', 'top-left');
        transformedY = workArea.x;
        transformedY = workArea.y;
    } else if (relativeX <= 0.25 && relativeY >= 0.75) {
        settingsStore.set('origin', 'bottom-left');
        transformedX = workArea.x;
        transformedY = workArea.height - size;
    } else if (relativeX < 0.25) {
        settingsStore.set('origin', 'left');
        transformedX = workArea.x;
        transformedY = y;
    } else if (relativeX > 0.75) {
        settingsStore.set('origin', 'right');
        transformedX = workArea.width - size;
        transformedY = y;
    } else if (relativeY < 0.25) {
        settingsStore.set('origin', 'top');
        transformedX = x;
        transformedY = workArea.y;
    } else if (relativeY > 0.75) {
        settingsStore.set('origin', 'bottom');
        transformedX = x;
        transformedY = workArea.height - size;
    } else {
        settingsStore.set('origin', 'center');
        let offset;
        if (size < width) {
            offset = (width - size) / 2;
            transformedX = x + offset;
            transformedY = y + offset;
        } else {
            offset = (size - width) / 2;
            transformedX = x - offset;
            transformedY = y - offset;
        }
    }

    if (data && data.pin) {
        win.setBounds({
            width: size,
            height: size,
            x: transformedX,
            y: transformedY
        });

        setRelativeBounds('x', transformedX, win);
        setRelativeBounds('y', transformedY, win);
    }
}

module.exports = { getOrigin, setOrigin };
