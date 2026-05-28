const { app } = require('electron');
const { postDoorState } = require('./requests');
const { appStore } = require('./MemoryStore');

async function toggleDoor(_, nextState = null) {
    const currentlyOpen = appStore.get('user.doorOpen');

    const nextDoorState = nextState !== null ? nextState : !currentlyOpen;

    if (
        (currentlyOpen && nextDoorState) ||
        (!currentlyOpen && !nextDoorState)
    ) {
        return;
    }

    try {
        await postDoorState(nextDoorState);
        changeUserDoorState(nextDoorState);
        app.emit('rerenderTray');
    } catch (error) {
        console.log(error);
    }
}

const changeUserDoorState = (state) => {
    const user = appStore.get('user');
    appStore.setState({ user: { ...user, doorOpen: state } });
};

async function closeDoor() {
    await toggleDoor(null, false);
}

async function openDoor() {
    await toggleDoor(null, true);
}

module.exports = {
    toggleDoor,
    closeDoor,
    openDoor
};
