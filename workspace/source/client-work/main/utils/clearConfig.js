const rimraf = require('rimraf');
const getAppDataPath = require('appdata-path');

module.exports = (async () => {
    const removeDir = process.argv[2] === '--rf';

    const appDataPath = getAppDataPath();
    rimraf(
        `${appDataPath}/${process.env.npm_package_productName}${
            removeDir ? '' : '/*.json'
        }`,
        () => {}
    );
})();
