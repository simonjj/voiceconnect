const stringToHexColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let colour = '#';
    for (let i = 0; i < 3; i++) {
        let value = (hash >> (i * 8)) & 0xff;
        colour += ('00' + value.toString(16)).substr(-2);
    }
    return colour;
};

const getBoxShadow = (amplitude, index, color) => {
    if (!amplitude) return '';

    const max = 15;
    const spreadRadius = Math.floor(amplitude * max);

    return `0 0 0 ${spreadRadius}px ${color}`;
};

const setBackgroundColor = (isParticipating, ref) => {
    const color = stringToHexColor(isParticipating.code);
    const css = ref.current && ref.current.style;
    if (css) css.setProperty('--member-active-color', color);
};

module.exports = { stringToHexColor, getBoxShadow, setBackgroundColor };
