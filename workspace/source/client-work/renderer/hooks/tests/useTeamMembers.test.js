import React from 'react';

import { useTeamMembers } from '../useTeamMembers';
import { act } from 'react-dom/test-utils';
import { render } from 'react-dom';

const mockUser = {
    nickname: 'Dylan',
    _id: '4567'
};

const mockTeamMembers = [
    { nickname: 'Aaron', _id: '1234' },
    { nickname: 'Nicole', _id: '2345' },
    { nickname: 'Matthew', _id: '3456' },
    mockUser
];

jest.mock(
    '../../lib/ipcRenderer',
    () => ({
        invoke: jest.fn(),
        on: jest.fn(),
        removeListener: jest.fn()
    }),
    { virtual: true }
);

jest.mock('../useAppState', () => ({
    useAppState: () => [
        {
            team: {
                members: mockTeamMembers
            },
            user: mockUser
        }
    ]
}));

describe('useTeamMembers', () => {
    test('useTeamMembers returns team with user when includeSelf is true', async () => {
        const Component = () => {
            const teamMembers = useTeamMembers(true);

            return (
                <ul>
                    {teamMembers.map((tm) => (
                        <li key={tm._id}>{tm.nickname}</li>
                    ))}
                </ul>
            );
        };

        await act(async () => {
            render(<Component />, container);
        });

        mockTeamMembers.forEach((tm) => {
            expect(container.textContent).toContain(tm.nickname);
        });
    });
});
