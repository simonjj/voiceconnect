const { joinTeam } = require('../lib/requests');
const { setInitialOnboardingState } = require('./onboardingState');

const handleCustomProtocol = async (
    url,
    isLaunch = false,
    updateInviteTeamCode
) => {
    const { appStore } = require('../lib/MemoryStore');
    const user = appStore.get('user');
    url = new URL(url);

    const code = url.searchParams.get('code');
    const teamCode = url.searchParams.get('teamCode');

    if (!user) {
        if (teamCode) updateInviteTeamCode(teamCode);
        if (code) {
            try {
                const authentication = require('../lib/auth');
                await authentication.loadTokens(url, code);
                if (!isLaunch) {
                    const welcome = require('../windows/welcome');
                    const welcomeWindow = welcome.getWelcomeWindow();
                    if (welcomeWindow) welcomeWindow.close();
                    return true;
                }
            } catch (error) {
                console.log(error);
            }
        }
    } else {
        const team = appStore.get('team');
        const firstVisit = appStore.get('firstVisit');

        if (!team && teamCode) {
            const team = await joinTeam(teamCode);
            appStore.setState({ team });

            if (firstVisit) {
                setInitialOnboardingState();
            } else {
                const onboarding = require('../windows/onboarding');
                const onboardingWindow = onboarding.getOnboardingWindow();
                if (onboardingWindow) onboardingWindow.close();
                return true;
            }
        }
    }
};

module.exports = handleCustomProtocol;
