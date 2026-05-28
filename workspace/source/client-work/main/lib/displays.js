/* istanbul ignore file */
/* eslint-disable no-undef */
const { app, screen } = require('electron');
const { WINDOW_RAISE_OPACITY } = require('../../shared/constants');

let allDisplays = [];
let primaryDisplay = [];
let secondaryDisplays = [];

app.on('ready', () => {
    allDisplays = screen.getAllDisplays();
    primaryDisplay = screen.getPrimaryDisplay();
    secondaryDisplays = allDisplays.filter(
        (display) => display.id !== primaryDisplay.id
    );
});

const getCurrentDisplay = (window) => {
    allDisplays = screen.getAllDisplays();
    const windowBounds = window.getBounds();
    const currentDisplay = screen.getDisplayNearestPoint({
        x: windowBounds.x,
        y: windowBounds.y
    });

    return allDisplays.filter((display) => display.id === currentDisplay.id);
};

const snapWindowToDisplay = async (window, data) => {
    const windowBounds = window.getBounds();
    const display = screen.getDisplayNearestPoint({
        x: windowBounds.x,
        y: windowBounds.y
    });
    const displayBounds = display.bounds;
    const onPrimaryDisplay = primaryDisplay.id === display.id;
    let horizontalDivide = displayBounds.width / 2;
    let verticalDivide = displayBounds.height / 2;

    const getDiff = (position) => {
        let newPosition;
        let diff;

        if (position === 'left') {
            newPosition = displayBounds.x - 50;
            diff = data.x - newPosition;
        }
        if (position === 'right') {
            const displayPosition =
                displayBounds.width - windowBounds.width / 2;
            newPosition = onPrimaryDisplay
                ? displayPosition
                : displayBounds.x + displayPosition;
            diff = newPosition - data.x;
        }
        if (position === 'top') {
            newPosition = displayBounds.y - 50;
            diff = onPrimaryDisplay
                ? data.y - newPosition
                : data.y - displayBounds.y;
        }
        if (position === 'bottom') {
            const displayPosition =
                displayBounds.height - windowBounds.height / 2;
            newPosition = onPrimaryDisplay
                ? displayPosition
                : displayBounds.y + displayPosition;
            diff = newPosition - data.y;
        }

        return { newPosition, diff: Math.abs(diff) };
    };

    if (!onPrimaryDisplay) {
        horizontalDivide = horizontalDivide + displayBounds.x;
        verticalDivide =
            verticalDivide + displayBounds.y - windowBounds.height / 2;
    }

    const { newPosition: xSnappedPosition, diff: xDiff } =
        data.x <= horizontalDivide ? getDiff('left') : getDiff('right');

    const { newPosition: ySnappedPosition, diff: yDiff } =
        data.y <= verticalDivide ? getDiff('top') : getDiff('bottom');

    const x = xDiff < yDiff ? xSnappedPosition : data.x;
    const y = yDiff <= xDiff ? ySnappedPosition : data.y;

    const animate = async (_window) => {
        const snapHorizontal = xDiff < yDiff;
        const diff = snapHorizontal ? xDiff : yDiff;
        const step = 4;
        let counter = 0;
        let winMoveTimer = null;
        let point;

        const getPoint = () => {
            const currentX = counter !== 0 ? point : data.x;
            const currentY = counter !== 0 ? point : data.y;
            return snapHorizontal ? currentX : currentY;
        };

        const getCurrentPosition = (point) => {
            const absPoint = Math.abs(point);
            const overBoundsX =
                point + windowBounds.width / 2 > displayBounds.width;
            const overBoundsY =
                point + windowBounds.height / 2 > displayBounds.height;
            const overBounds = snapHorizontal ? overBoundsX : overBoundsY;

            const animateDecrementX =
                (onPrimaryDisplay && overBounds) ||
                (onPrimaryDisplay && data.x <= horizontalDivide) ||
                (onPrimaryDisplay &&
                    data.x > horizontalDivide &&
                    point !== absPoint) ||
                (!onPrimaryDisplay &&
                    data.x <= horizontalDivide &&
                    data.x > displayBounds.x) ||
                data.x >
                    displayBounds.x + displayBounds.width - windowBounds.width;
            const animateDecrementY =
                (onPrimaryDisplay && overBounds) ||
                data.y <= verticalDivide ||
                data.y >
                    displayBounds.y +
                        displayBounds.height -
                        windowBounds.height;

            if (snapHorizontal) {
                return animateDecrementX ? point - step : point + step;
            } else {
                return animateDecrementY ? point - step : point + step;
            }
        };

        const animateOnAxis = (animationPoint) => {
            if (snapHorizontal) {
                _window.setPosition(animationPoint, y);
            } else {
                _window.setPosition(x, animationPoint);
            }
        };

        const winMove = (duration) => {
            clearTimeout(winMoveTimer);

            if (counter > diff + 50) {
                winMoveTimer = clearTimeout(winMoveTimer);
            } else {
                const currentPoint = getPoint();
                const animationPoint = getCurrentPosition(currentPoint);
                animateOnAxis(animationPoint);
                counter += step;
                point = animationPoint;
                winMoveTimer = setTimeout(winMove, duration);
            }
        };

        winMove(1);
    };

    animate(window);

    const updatedWindowData = {
        ...data,
        x: x,
        y: y,
        display
    };

    return updatedWindowData;
};

const slideWindowFromDisplay = async (window, data) => {
    const windowBounds = window.getBounds();
    const display = screen.getDisplayNearestPoint({
        x: windowBounds.x,
        y: windowBounds.y
    });
    const displayBounds = display.bounds;
    const onPrimaryDisplay = primaryDisplay.id === display.id;
    let horizontalDivide = displayBounds.width / 2;
    let verticalDivide = displayBounds.height / 2;

    const getDiff = (position) => {
        let newPosition;
        let diff;

        if (position === 'left') {
            newPosition = displayBounds.x;
            diff = data.x - newPosition;
        }
        if (position === 'right') {
            const displayPosition = displayBounds.width - windowBounds.width;
            newPosition = displayPosition;
            diff = newPosition - data.x + displayBounds.x;
        }
        if (position === 'top') {
            newPosition = displayBounds.y;
            diff = data.y - newPosition;
        }
        if (position === 'bottom') {
            const displayPosition = displayBounds.height - windowBounds.height;
            newPosition = displayPosition;
            diff = newPosition - data.y + displayBounds.y;
        }

        return { newPosition, diff: Math.abs(diff) };
    };

    const { newPosition: xSlidePosition, diff: xDiff } =
        data.x <= horizontalDivide ? getDiff('left') : getDiff('right');

    const { newPosition: ySlidePosition, diff: yDiff } =
        data.y <= verticalDivide ? getDiff('top') : getDiff('bottom');

    const x = xDiff < yDiff ? xSlidePosition : data.x;
    const y = yDiff <= xDiff ? ySlidePosition : data.y;

    const animate = async (_window) => {
        const slideHorizontal = xDiff < yDiff;
        const diff = slideHorizontal ? xDiff : yDiff;
        const step = 1;
        let counter = 0;
        let winMoveTimer = null;
        let point;

        const getPoint = () => {
            const currentX = counter !== 0 ? point : data.x;
            const currentY = counter !== 0 ? point : data.y;
            return slideHorizontal ? currentX : currentY;
        };

        const getCurrentPosition = (point) => {
            const absPoint = Math.abs(point);

            const animateDecrementX =
                (data.x > horizontalDivide && point !== absPoint) ||
                (!onPrimaryDisplay &&
                    data.x <= horizontalDivide &&
                    data.x > displayBounds.x) ||
                data.x >
                    displayBounds.x + displayBounds.width - windowBounds.width;
            const animateDecrementY =
                data.y <= verticalDivide ||
                data.y >
                    displayBounds.y +
                        displayBounds.height -
                        windowBounds.height;

            if (slideHorizontal) {
                return animateDecrementX ? point - step : point + step;
            } else {
                return animateDecrementY ? point - step : point + step;
            }
        };

        const animateOnAxis = (animationPoint) => {
            if (slideHorizontal) {
                _window.setPosition(animationPoint, y);
            } else {
                _window.setPosition(x, animationPoint);
            }
        };

        const winMove = (duration) => {
            clearTimeout(winMoveTimer);

            if (counter > diff) {
                winMoveTimer = clearTimeout(winMoveTimer);
                window.send(WINDOW_RAISE_OPACITY);
            } else {
                const currentPoint = getPoint();
                const animationPoint = getCurrentPosition(currentPoint);
                animateOnAxis(animationPoint);
                counter += step;
                point = animationPoint;
                winMoveTimer = setTimeout(winMove, duration);
            }
        };

        winMove(1);
    };

    animate(window);
};

const verifyCurrentDisplay = (display) => {
    return screen.getAllDisplays().filter((s) => s.id === display.id);
};

module.exports = {
    allDisplays,
    primaryDisplay,
    secondaryDisplays,
    getCurrentDisplay,
    snapWindowToDisplay,
    slideWindowFromDisplay,
    verifyCurrentDisplay
};
