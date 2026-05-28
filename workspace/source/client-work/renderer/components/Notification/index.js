import './style.css';
import React from 'react';
import PropTypes from 'prop-types';

import loadable from '@loadable/component';

import { useAppState } from '../../hooks/useAppState';
import { NOTIFICATION_VIEWS } from '../../../shared/constants';

const DeviceError = loadable(() =>
    import(/* webpackChunkName: "device-error" */ './DeviceError')
);
const LogOut = loadable(() =>
    import(/* webpackChunkName: "logout" */ '../LogOut')
);
const MultiDevice = loadable(() =>
    import(/* webpackChunkName: "multi-device" */ './MultiDevice')
);
const AppError = loadable(() =>
    import(/* webpackChunkName: "app-error" */ './AppError')
);
const AppUpdate = loadable(() =>
    import(/* webpackChunkName: "app-update" */ './AppUpdate')
);
const AppUpdateCheck = loadable(() =>
    import(/* webpackChunkName: "app-update-check" */ './AppUpdateCheck')
);

const AppUpdateNotAvailable = loadable(() =>
    import(
        /* webpackChunkName: "app-update-not-available" */ './AppUpdateNotAvailable'
    )
);

const PrivateConversationWarning = loadable(() =>
    import(
        /* webpackChunkName: "private-conversation-warning" */ './PrivateConversationWarning'
    )
);

const NotificationView = ({ view }) => {
    switch (view) {
        case NOTIFICATION_VIEWS.DEVICE_ERROR:
            return <DeviceError />;
        case NOTIFICATION_VIEWS.LOG_OUT:
            return <LogOut />;
        case NOTIFICATION_VIEWS.MULTI_DEVICE:
            return <MultiDevice />;
        case NOTIFICATION_VIEWS.APP_ERROR:
            return <AppError />;
        case NOTIFICATION_VIEWS.APP_UPDATE:
            return <AppUpdate />;
        case NOTIFICATION_VIEWS.APP_UPDATE_CHECK:
            return <AppUpdateCheck />;
        case NOTIFICATION_VIEWS.APP_UPDATE_NOT_AVAILABLE:
            return <AppUpdateNotAvailable />;
        case NOTIFICATION_VIEWS.PRIVATE_WARN:
            return <PrivateConversationWarning />;
        default:
            return <div>No view yet</div>;
    }
};

NotificationView.propTypes = {
    view: PropTypes.oneOf([
        NOTIFICATION_VIEWS.DEVICE_ERROR,
        NOTIFICATION_VIEWS.LOG_OUT,
        NOTIFICATION_VIEWS.MULTI_DEVICE,
        NOTIFICATION_VIEWS.APP_ERROR,
        NOTIFICATION_VIEWS.APP_UPDATE,
        NOTIFICATION_VIEWS.APP_UPDATE_CHECK,
        NOTIFICATION_VIEWS.APP_UPDATE_NOT_AVAILABLE
    ])
};

const Notification = () => {
    const [appState] = useAppState();

    return (
        <div className="notification-view">
            <NotificationView view={appState.notificationView} />
        </div>
    );
};

export default Notification;
