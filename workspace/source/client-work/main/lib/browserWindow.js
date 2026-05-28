/* istanbul ignore file */
const { BrowserWindow, screen } = require('electron');
const debug = require('debug')('ttc:main:browser');
const { WINDOW_MOVE_EVENT } = require('../../shared/constants');
const {
    getCurrentDisplay,
    snapWindowToDisplay,
    slideWindowFromDisplay
} = require('./displays');

const getDimensions = (window) => {
    const { width, height } = window.getBounds();
    return { width, height };
};

const windowOptions = {
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    show: false,
    webPreferences: {
        nodeIntegration: false,
        enableRemoteModule: false
    }
};

const updateWindowData = (window, event) => {
    const eventBounds = event.sender.getBounds();
    const [displayWindow] = getCurrentDisplay(window);
    const windowData = {
        bounds: eventBounds,
        display: {
            id: displayWindow.id,
            workArea: displayWindow.workArea
        },
        window: {
            id: window.id,
            slug: window.slug
        }
    };

    window.send(WINDOW_MOVE_EVENT, windowData);
};

const generateChildWindow = (x, y, height, width, parent) => {
    return new BrowserWindow({
        ...windowOptions,
        height: height,
        width: width,
        x: x,
        y: y,
        parent
    });
};

const animateUserWindow = async (window, type) => {
    const { height, width } = getDimensions(window);

    if (type === 'slideOut') {
        const bounds = window.getBounds();
        await slideWindowFromDisplay(window, bounds);
        return;
    }

    const data = window.getBounds();
    window.setBounds({ x: data.x, y: data.y });

    const updatedData = await snapWindowToDisplay(window, data);

    window.store.set('bounds', {
        x: updatedData.x,
        y: updatedData.y,
        height: height,
        width: width
    });

    window.store.set('display', {
        id: updatedData.display.id,
        ...updatedData.display.bounds
    });

    window.store.set('relativeBounds', {
        x: setRelativeBounds('x', updatedData.x, window),
        y: setRelativeBounds('y', updatedData.y, window)
    });
};

const getInitialBounds = (store, height, width) => {
    const { x, y } = store.get('relativeBounds');
    let totalWidth = 0;
    let totalNegativeWidth = 0;
    let totalPositiveWidth = 0;
    let initialBounds = {};
    let relativeX;
    let relativeY;

    const displays = screen.getAllDisplays().map((d) => {
        totalWidth += d.bounds.width;

        if (d.bounds.x === Math.abs(d.bounds.x)) {
            totalPositiveWidth += d.bounds.width;
        } else {
            totalNegativeWidth += d.bounds.width;
        }

        return d;
    });

    const negativeBreakpoint = totalNegativeWidth / totalWidth;

    if (negativeBreakpoint > 0 && x < negativeBreakpoint) {
        debug('Multi display, on negative display');
        relativeX = Math.round(
            x * (totalWidth - width) + (totalPositiveWidth - totalWidth)
        );
    } else if (negativeBreakpoint > 0 && x >= negativeBreakpoint) {
        debug('Multi display, on positive display');
        relativeX = Math.round(x * (totalWidth - width) - totalNegativeWidth);
    } else if (displays.length > 1) {
        debug('Multi display, no negative breakpoint');
        relativeX = Math.round(x * (totalWidth - width) - totalNegativeWidth);
    } else {
        debug('On single display');
        relativeX = Math.round(x * (totalWidth - width));
    }

    const display = screen.getDisplayNearestPoint({ x: relativeX, y: 0 });
    relativeY = Math.round(
        y * (display.bounds.height - height) + display.bounds.y
    );

    initialBounds.x = relativeX;
    initialBounds.y = relativeY;

    return initialBounds;
};

const setRelativeBounds = (type, data, window) => {
    const { height, width } = getDimensions(window);
    const [display] = getCurrentDisplay(window);
    let totalWidth = 0;
    let totalPositiveWidth = 0;
    let totalNegativeWidth = 0;
    let percentage = 0;

    const displays = screen.getAllDisplays().map((d) => {
        totalWidth += d.bounds.width;

        if (d.bounds.x === Math.abs(d.bounds.x)) {
            totalPositiveWidth += d.bounds.width;
        } else {
            totalNegativeWidth += d.bounds.width;
        }
        return d;
    });

    if (displays.length > 1) {
        if (display.bounds.x !== Math.abs(display.bounds.x)) {
            debug('On negative display');
            percentage =
                (type === 'x'
                    ? totalNegativeWidth + data
                    : data - display.bounds.y) /
                (type === 'x'
                    ? totalWidth - width
                    : display.bounds.height - height);
        } else {
            debug('On positive display');
            percentage =
                (type === 'x'
                    ? totalWidth - totalPositiveWidth + data
                    : data - display.bounds.y) /
                (type === 'x'
                    ? totalWidth - width
                    : display.bounds.height - height);
        }
    } else {
        debug('Single display');
        percentage =
            data /
            (type === 'x'
                ? display.bounds.width - width
                : display.bounds.height - height);
    }

    const savedBounds = window.store.get('relativeBounds');
    debug(`Percentage ${type}: ${percentage}`);

    window.store.set('relativeBounds', {
        ...savedBounds,
        [type]: percentage
    });
};

const getKnockWindow = () =>
    BrowserWindow.getAllWindows().find((w) => w.slug === 'knock');

module.exports = {
    windowOptions,
    generateChildWindow,
    updateWindowData,
    animateUserWindow,
    setRelativeBounds,
    getInitialBounds,
    getKnockWindow
};
