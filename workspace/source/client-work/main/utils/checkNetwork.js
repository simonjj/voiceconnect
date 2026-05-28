const checkNetwork = (fn, retrySleep = 1000, retryMax = 3) => {
    let retryCount = 0;
    let retryTimer = null;

    return new Promise(async (resolve, reject) => {
        async function doCheck() {
            clearTimeout(retryTimer);
            try {
                const res = await fn();
                if (res.ok && retryCount === 0) return resolve(res);
                else if (res.ok) return setTimeout(resolve, 150, res);
            } catch (err) {
                if (retryCount < retryMax) {
                    retryCount++;
                    retryTimer = setTimeout(doCheck, retrySleep);
                } else reject(err);
            }
        }
        await doCheck();
    });
};

module.exports = checkNetwork;
