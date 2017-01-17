// This is the root test file. This contains no tests.
// This only contains root level hooks.

// Set up the test environment.
before(() => {
    process.env.ADMIN_USERNAME = 'foo';
    process.env.ADMIN_PASSWORD = 'bar';
    process.env.API_URL = 'http://thisisnotarealserver.localdev';

    require('babel-polyfill');
    require('co-mocha');
});

