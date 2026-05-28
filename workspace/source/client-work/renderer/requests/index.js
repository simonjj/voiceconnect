/* global config */
const baseURL = config.apiBaseURL;

export async function createTeam(newTeamName) {
    try {
        const res = await fetch(`${baseURL}/teams`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: newTeamName
            })
        });

        if (res.ok) {
            return await res.json();
        } else {
            throw res;
        }
    } catch (err) {
        console.error('Unable to create team', err);
        throw res;
    }
}

export async function fetchHelpContent() {
    try {
        const res = await fetch(window.helpURL);
        if (res.ok) {
            return await res.text();
        }
    } catch (err) {
        console.error('Unable to download help page', err);
    }
}

export async function joinTeam(teamCode) {
    try {
        const res = await fetch(`${baseURL}/team/${teamCode}/membership`, {
            method: 'PUT'
        });
        if (res.ok) {
            return await res.json();
        } else {
            throw res;
        }
    } catch (err) {
        console.error('Unable to join team', err);
        throw err;
    }
}

export async function fetchProfile(isLaunch = false) {
    try {
        const res = await fetch(`${baseURL}/profile/${isLaunch}`);
        if (res.ok) {
            return await res.json();
        }
    } catch (err) {
        console.error('Unable to download profile data', err);
    }
}

export const updateUserProfile = async (user) => {
    try {
        const res = await fetch(`${baseURL}/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(user)
        });
        if (res.ok) {
            return await res.json();
        }
    } catch (err) {
        console.error('Unable to update profile', err);
    }
};

export async function reqStartConversation(payload) {
    try {
        await fetch(`${baseURL}/conversations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.error('Unable to start conversation', err);
    }
}

export async function reqPrivateConversation() {
    try {
        await fetch(`${baseURL}/conversation/private`, {
            method: 'PUT',
            headers: {
                Accept: 'application/json'
            },
            body: null
        });
    } catch (err) {
        console.log('Unable to set private conversation', err);
    }
}

export async function reqLeaveConversation() {
    try {
        await fetch(`${baseURL}/conversations/leave`, {
            method: 'POST',
            headers: {
                Accept: 'application/json'
            },
            body: null
        });
    } catch (err) {
        console.log('Unable to leave conversation(s)', err);
    }
}

export async function reqDeleteMemberFromConversation(
    conversationId,
    memberId
) {
    try {
        await fetch(`${baseURL}/${conversationId}/disconnect`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ memberId })
        });
    } catch (err) {
        console.log('Unable to delete member', err);
    }
}

export async function triggerConversationUpdate() {
    try {
        await fetch(`${baseURL}/conversations-update`);
    } catch (err) {
        console.log('Unable to update conversation', err);
    }
}

export async function createInvitations(payload) {
    try {
        await fetch(`${baseURL}/invitation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.log('Unable to invite member', err);
    }
}

export async function reqFirstVisitState() {
    await fetch(`${baseURL}/first-visit`, {
        method: 'POST'
    });
}

export async function removeTeamMember(userId, teamCode) {
    try {
        await fetch(`${baseURL}/team/${teamCode}/membership/remove`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ id: userId })
        });
    } catch (err) {
        console.log('Unable to delete Team Member', err);
    }
}

export async function setAdmin(userId, teamCode) {
    try {
        await fetch(`${baseURL}/team/${teamCode}/admin/set`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ id: userId })
        });
    } catch (err) {
        console.log('Unable to set Admin', err);
    }
}

export async function unsetAdmin(userId, teamCode) {
    try {
        await fetch(`${baseURL}/team/${teamCode}/admin/unset`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ id: userId })
        });
    } catch (err) {
        console.log('Unable to unset Admin', err);
    }
}

export async function updatePrivacyState(owner, teamCode, isPrivate) {
    try {
        await fetch(`${baseURL}/team/${teamCode}/privacy/${isPrivate}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ owner: owner })
        });
    } catch (err) {
        console.log('Unable to update privacy', err);
    }
}

export async function updateTeamOwner(id, teamCode) {
    try {
        await fetch(`${baseURL}/team/${teamCode}/owner/update`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ id: id })
        });
    } catch (err) {
        console.log('Unable to update owner', err);
    }
}
