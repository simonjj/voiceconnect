(function() {
    const url = new URL(window.location.href);
    const teamCode = url.searchParams.get('teamCode');
    if (teamCode) {
        const container = document.querySelector('.description');
        const teamBlock = document.createElement('span');
        teamBlock.classList.add('team');
        container.appendChild(teamBlock);
        teamBlock.innerText = `Launching to Team «${teamCode}»`;
    }

    let fallbackLink = `connect://${url.search}`;

    window.setTimeout(function() {
        window.location.replace(fallbackLink);
    }, 1);
})();
