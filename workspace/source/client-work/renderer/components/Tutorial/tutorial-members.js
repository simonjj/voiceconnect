import React, { useMemo } from 'react';
import loadable from '@loadable/component';

import './style.scss';

const TutorialMember = loadable(() =>
    import(
        /* webpackChunkName: "tutorial-member-online" */ './mock-member/TutorialMember'
    )
);

const OfflineMember = loadable(() =>
    import(
        /* webpackChunkName: "tutorial-member-offline" */ '../Member/Offline'
    )
);

const TutorialMembers = ({ onNext, team, user, onHoverNext }) => {
    const validTeam = useMemo(() => {
        if (team && user) {
            const member = Object.values(team).filter(
                (member) => member.id !== user._id
            );
            member.polite = +new Date(member.lastLogin) > user.lastLogin;
            return member;
        }
        return null;
    }, [team, user]);

    return (
        <div className="Members-container">
            {team &&
                validTeam.map((member, index) => {
                    if (member.online) {
                        return (
                            <TutorialMember
                                key={member.id}
                                member={member}
                                onNext={onNext}
                                onHoverNext={onHoverNext}
                                index={index}
                            />
                        );
                    }

                    return (
                        <OfflineMember
                            key={member.id}
                            index={index}
                            tutorial
                            member={member}
                        />
                    );
                })}
        </div>
    );
};

export default TutorialMembers;
