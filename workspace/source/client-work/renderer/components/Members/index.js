import React, { useMemo } from 'react';

import loadable from '@loadable/component';
import clx from 'clsx';
import { classNameParser } from './helpers';

import './style.scss';

const OnlineMember = loadable(() =>
    import(/* webpackChunkName: "OnlineMember" */ '../Member')
);
const OfflineMember = loadable(() =>
    import(/* webpackChunkName: "OfflineMember" */ '../Member/Offline')
);

const AddMembers = loadable(() =>
    import(/* webpackChunkName: "AddMembers" */ '../Member/AddMembers')
);

const Members = ({ isOnline, step, team, user, switchingPages }) => {
    const lastLogin = +new Date(user.lastLogin);

    const validMembers = useMemo(() => {
        return team && team.length
            ? team.sort((a, b) => b.online - a.online)
            : [];
    }, [team, user]);

    return (
        <div className={clx('Members', { offline: !isOnline })}>
            {validMembers.length > 0 &&
                validMembers.map((member, index) => {
                    member.polite = +new Date(member.lastLogin) > lastLogin;
                    const active =
                        index + 1 <= step * 8 && index + 1 > (step - 1) * 8;
                    const className = classNameParser(active && index % 8);

                    if (member.online) {
                        return (
                            <OnlineMember
                                step={step}
                                key={member.id}
                                className={className}
                                index={index}
                                switchingPages={switchingPages}
                                member={member}
                            />
                        );
                    }

                    return (
                        <OfflineMember
                            step={step}
                            key={member.id}
                            className={className}
                            index={index}
                            switchingPages={switchingPages}
                            member={member}
                        />
                    );
                })}
            {validMembers.length === 0 && <AddMembers />}
        </div>
    );
};

export default Members;
