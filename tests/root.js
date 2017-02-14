/*
 * Copyright (c) 2017 SugarCRM Inc. Licensed by SugarCRM under the Apache 2.0 license.
 */

// This is the root test file. This contains no tests.
// This only contains root level hooks.

// Set up the test environment.
before(() => {
    process.env.THORN_ADMIN_USERNAME = 'foo';
    process.env.THORN_ADMIN_PASSWORD = 'bar';
    process.env.THORN_SERVER_URL = 'http://thisisnotarealserver.localdev';

    require('babel-polyfill');
    require('co-mocha');
});

