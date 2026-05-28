module.exports = (win) => {
    if (
        (process.env.INSPECT && process.env.INSPECT.indexOf(win.slug) !== -1) ||
        (process.env.INSPECT && process.env.INSPECT === '*')
    )
        win.webContents.openDevTools({ mode: 'undocked' });
};
