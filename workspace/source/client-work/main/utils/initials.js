function initials(name) {
    const [[firstInitial]] = name;
    const nameWords = name.split(' ');
    if (nameWords.length === 1) {
        return firstInitial.toUpperCase();
    }

    const [lastInitial] = nameWords[nameWords.length - 1];

    return `${firstInitial}${lastInitial}`.toUpperCase();
}

module.exports = initials;
