const { Notification } = require('electron');

const { KNOCK_RECEIVED, KNOCK_EXPIRED } = require('../../shared/constants');

const notificationTemplates = {
    [KNOCK_RECEIVED]: ({ name }) => ({
        title: `${name} is knocking on your door...`,
        silent: false
    }),
    [KNOCK_EXPIRED]: ({ name }) => ({
        title: `${name} knocked on your door.`,
        silent: false
    })
};

class Notifications {
    constructor() {
        this.activeKnockNotifications = [];
    }

    createKnockNotification(props) {
        const notifProps = notificationTemplates[KNOCK_RECEIVED](props);
        const n = new Notification(notifProps);
        this.registerNotification(KNOCK_RECEIVED, props, n);
        n.show();
    }

    createMissedKnockNotification(props) {
        const notifProps = notificationTemplates[KNOCK_EXPIRED](props);
        const n = new Notification(notifProps);
        const receivedNotif = this.activeKnockNotifications.find(
            (n) => n.eventType === KNOCK_RECEIVED && n.props.name === props.name
        );
        if (receivedNotif) {
            receivedNotif.instance.close();
        }
        this.activeKnockNotifications = this.activeKnockNotifications.filter(
            (n) => n !== receivedNotif
        );
        n.show();
    }

    registerNotification(eventType, props, instance) {
        this.activeKnockNotifications = [
            ...this.activeKnockNotifications,
            { eventType, props, instance }
        ];
    }
}

module.exports = new Notifications();
