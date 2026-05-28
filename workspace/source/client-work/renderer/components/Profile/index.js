import React, { useState, useEffect, useMemo, useCallback } from 'react';
import clsx from 'clsx';
import propTypes from 'prop-types';
import { isEmpty } from '../../utilities/isEmpty';
import { ProfileForm } from './profile-form';
import { ProfileColorPicker } from './profile-color-picker';
import { fetchProfile, updateUserProfile } from '../../requests';

import './styles.scss';

const Profile = ({ className }) => {
    const [user, setUser] = useState({});

    const getProfile = useCallback(async () => {
        const profile = await fetchProfile();
        if (!isEmpty(profile)) {
            setUser({
                firstName: profile.firstName,
                lastName: profile.lastName,
                nickname: profile.nickname,
                avatarColor: profile.avatarColor,
                defaultDoor:
                    profile.defaultDoor !== null ? profile.defaultDoor : '',
                isKnockRequired: profile.isKnockRequired
            });
        }
    }, []);

    useEffect(() => {
        getProfile();
    }, [getProfile]);

    const handleChange = (value) => {
        setUser({
            ...user,
            ...value
        });
    };

    const handleInitials = useMemo(() => {
        const spaceCheck = / /;
        if (user.nickname) {
            if (spaceCheck.test(user.nickname)) {
                return user.nickname
                    .split(' ')
                    .map((p) => p.substr(0, 1))
                    .join('');
            }
            return user.nickname.substr(0, 2);
        }
    }, [user.nickname]);

    const handleSubmit = async () => {
        let defaultDoor = user.defaultDoor;
        if (defaultDoor !== true && defaultDoor !== false) {
            defaultDoor = null;
        }

        await updateUserProfile({ ...user, defaultDoor });
    };

    if (isEmpty(user)) return null;

    return (
        <div className={clsx('profile-container', className)}>
            <ProfileForm
                user={user}
                onChange={handleChange}
                onSubmit={handleSubmit}
            />
            <ProfileColorPicker
                initials={handleInitials}
                initialColor={user.avatarColor}
                onColorChange={handleChange}
                onSelect={(color) => handleSubmit(color)}
            />
        </div>
    );
};

Profile.propTypes = {
    className: propTypes.string
};

export default Profile;
