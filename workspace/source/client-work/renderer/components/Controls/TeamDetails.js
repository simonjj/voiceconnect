import React from 'react';
import { useTeamMembers } from '../../hooks/useTeamMembers';

const TeamDetails = () => {
    const teamMembers = useTeamMembers(true);

    return (
        <details className="o-form__field">
            <summary className="o-form__title">Team Details</summary>
            <table className="mdl-data-table mdl-js-data-table mdl-data-table--selectable mdl-shadow--2dp">
                <thead>
                    <tr>
                        <th className="mdl-data-table__cell--non-numeric">
                            Name
                        </th>
                        <th className="mdl-data-table__cell--non-numeric">
                            Email
                        </th>
                        <th className="mdl-data-table__cell--non-numeric">
                            ID
                        </th>
                        <th className="mdl-data-table__cell--non-numeric">
                            Online
                        </th>
                        <th className="mdl-data-table__cell--non-numeric">
                            Door
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {teamMembers.map((tm) => (
                        <tr key={tm._id}>
                            <td className="mdl-data-table__cell--non-numeric">
                                {tm.nickname}
                            </td>
                            <td className="mdl-data-table__cell--non-numeric">
                                {tm.email}
                            </td>
                            <td className="mdl-data-table__cell--non-numeric">
                                {tm._id}
                            </td>
                            <td className="mdl-data-table__cell--non-numeric">
                                {tm.online ? 'True' : 'False'}
                            </td>
                            <td className="mdl-data-table__cell--non-numeric">
                                {tm.doorOpen ? 'True' : 'False'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </details>
    );
};

export default TeamDetails;
