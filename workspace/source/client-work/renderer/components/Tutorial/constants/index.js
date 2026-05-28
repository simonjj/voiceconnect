export const TUTORIAL_STEPS = {
    step_1: {
        content:
            'Connect is controlled through the Agent. When your team members are online, their user dot will be colored, Clicking the user dot will start a conversation.',
        title: 'Start a conversation'
    },
    step_2: {
        content: `When you’re in a conversation you can easily add other team members by clicking their user dot.`,
        title: 'Add to conversation'
    },
    step_3: {
        content: `Leave a conversation by clicking the X.`,
        title: 'Leave conversation'
    },
    step_4: {
        content: `When others are in a conversation, you’ll hear it at a reduced volume unless they marked it private. To join the conversation, hover and click "Join", or click "Mute" if you’ve heard enough.`,
        title: 'Background conversation'
    },
    step_5: {
        content: `When others are in a conversation, you’ll hear it at a reduced volume unless they marked it private. To join the conversation, hover and click "Join", or click "Mute" if you’ve heard enough.`,
        title: 'Background conversation'
    },
    step_6: {
        content: `If you want a say whether a team mate can start a conversation with you, close your door and they’ll have to knock first. But with your door closed you won’t hear any background conversations.`,
        title: 'The door'
    }
};

export const MOCK_TEAM = [
    {
        avatarColor: '#c5c5cb3',
        code: 'mock_code_1',
        doorOpen: true,
        email: 'mockUser_1@test.com',
        id: 'tutorial_user_1',
        initials: 'CO',
        lastLogin: new Date(),
        muted: false,
        nickname: 'team member',
        online: false,
        _id: 'tutorial_user_1'
    },
    {
        avatarColor: '#c5c5cb3',
        code: 'mock_code_2',
        doorOpen: true,
        email: 'mockUser_2@test.com',
        id: 'tutorial_user_2',
        initials: 'NN',
        lastLogin: new Date(),
        muted: false,
        nickname: 'team member',
        online: false,
        _id: 'tutorial_user_2'
    },
    {
        avatarColor: '#c5c5cb3',
        code: 'mock_code_3',
        doorOpen: true,
        email: 'mockUser_3@test.com',
        id: 'tutorial_user_3',
        initials: 'EC',
        lastLogin: new Date(),
        muted: false,
        nickname: 'team member',
        online: false,
        _id: 'tutorial_user_3'
    },
    {
        avatarColor: '#c5c5cb3',
        code: 'mock_code_4',
        doorOpen: true,
        email: 'mockUser_4@test.com',
        id: 'tutorial_user_4',
        initials: 'TO',
        lastLogin: new Date(),
        muted: false,
        nickname: 'team member',
        online: false,
        _id: 'tutorial_user_4'
    },
    {
        avatarColor: '#c5c5cb3',
        code: 'mock_code_5',
        doorOpen: true,
        email: 'mockUser_5@test.com',
        id: 'tutorial_user_5',
        initials: 'RB',
        lastLogin: new Date(),
        muted: false,
        nickname: 'team member',
        online: false,
        _id: 'tutorial_user_5'
    },
    {
        avatarColor: '#c5c5cb3',
        code: 'mock_code_6',
        doorOpen: true,
        email: 'mockUser_6@test.com',
        id: 'tutorial_user_6',
        initials: 'TM',
        lastLogin: new Date(),
        muted: false,
        nickname: 'team member',
        online: false,
        _id: 'tutorial_user_6'
    },
    {
        avatarColor: '#c5c5cb3',
        code: 'mock_code_7',
        doorOpen: true,
        email: 'mockUser_7@test.com',
        id: 'tutorial_user_7',
        initials: 'TM',
        lastLogin: new Date(),
        muted: false,
        nickname: 'team member',
        online: false,
        _id: 'tutorial_user_7'
    }
];

export const createMockTeam = (settings, user) => {
    const filteredMembers = MOCK_TEAM.filter((el, index) => {
        return index + 1 <= settings.show;
    }).map((el, index) => {
        if (index + 1 <= settings.online) {
            return { ...el, online: true };
        }
        return el;
    });

    return [
        ...filteredMembers,
        {
            avatarColor: user.avatarColor,
            code: user.code,
            doorOpen: user.doorOpen,
            email: user.email,
            id: user.id,
            initials: user.initials,
            lastLogin: +new Date(user.lastLogin),
            muted: user.muted,
            nickname: user.nickname,
            online: user.online,
            _id: user._id
        }
    ];
};

export const TUTORIAL_PARTICIPATING_CODE = 'HSnMNFTON';
