const { ONBOARDING_STATES } = require('../../shared/constants');
const { appStore } = require('../lib/MemoryStore');

const setInitialOnboardingState = () => {
    const team = appStore.get('team');
    const hasTeamMembers = team.members.length;
    const onboardingState = hasTeamMembers
        ? ONBOARDING_STATES.TUTORIAL
        : ONBOARDING_STATES.MAIN;
    appStore.setState({ onboardingState });
};

module.exports = { setInitialOnboardingState };
