const request = require('../../utils/request');

function isLoggedIn() {
    return request.get('/isLoggedIn');
}

function logoutReq() {
    return request.get('/logout');
}

async function getConversations() {
    return await request.get('/conversations');
}

async function getUserAndTeam() {
    const [{ body: user }, { body: team }] = await Promise.all([
        request.get('/profile'),
        request.get('/team')
    ]);
    return [user, team];
}

async function postDoorState(doorState) {
    await request.put(`/door/${doorState}`);
}

async function reqFirstVisitState() {
    await request.post('/first-visit');
}

async function leaveTeam() {
    const { appStore } = require('../MemoryStore');
    const code = appStore.get('team.code');
    await endConversation();
    await request.delete(`/team/${code}/membership`);
}

async function startConversation(targetUser) {
    await request.post('/conversations').send({ targetUser });
}

async function endConversation(team) {
    await request.post('/conversations/leave').send({ team });
}

async function reqAcceptKnock() {
    await request.post('/knock/accept').send({});
}

async function reqDeclineKnock() {
    await request.post('/knock/decline').send({});
}

async function reqStartBroadcast() {
    try {
        await request.post('/conversations').send({ isBroadcast: true });
    } catch (err) {
        console.error('Unable to start conversation', err);
    }
}

async function requestTest() {
    return request.get('/request-test');
}

async function joinTeam(teamCode) {
    try {
        const { body: team } = await request.put(
            `/team/${teamCode}/membership`
        );
        return team;
    } catch (err) {
        console.error('Unable to join team', err);
    }
}

module.exports = {
    isLoggedIn,
    logoutReq,
    getConversations,
    getUserAndTeam,
    postDoorState,
    leaveTeam,
    joinTeam,
    startConversation,
    endConversation,
    reqAcceptKnock,
    reqDeclineKnock,
    requestTest,
    reqFirstVisitState,
    reqStartBroadcast
};
