const fetch = function() {};
global.fetch = fetch;

process.on('unhandledRejection', (reason) => {
    console.log('REJECTION', reason);
});
